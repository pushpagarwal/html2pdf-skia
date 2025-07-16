// CanvasKit WASM imports
import {
    CanvasKit,
    Canvas as SkiaCanvas,
    Paint as SkiaPaint,
    Path as SkiaPath,
    Shader as SkiaShader,
    Image as SkiaImage,
    Font as SkiaFont,
    Typeface,
    FontStyle,
    FontMgr,
} from 'canvaskit-wasm';

import { ElementPaint, parseStackingContexts, StackingContext } from '../stacking-context';
import { Color } from '../../css/types/color';
import { asString, isTransparent } from "../../css/types/color-utilities";
import { ElementContainer } from '../../dom/element-container';
import { BORDER_STYLE } from '../../css/property-descriptors/border-style';
import { CSSParsedDeclaration } from '../../css';
import { TextContainer } from '../../dom/text-container';
import { Path, transformPath } from '../path';
import { BACKGROUND_CLIP } from '../../css/property-descriptors/background-clip';
import { BoundCurves, calculateBorderBoxPath, calculateContentBoxPath, calculatePaddingBoxPath } from '../bound-curves';
import { BezierCurve, isBezierCurve } from '../bezier-curve';
import { Vector } from '../vector';
import { CSSURLImage, isLinearGradient, isRadialGradient } from '../../css/types/image';
import {
    parsePathForBorder,
    parsePathForBorderDoubleInner,
    parsePathForBorderDoubleOuter,
    parsePathForBorderStroke
} from '../border';
import { calculateBackgroundRendering, getBackgroundValueForIndex } from '../background';
import { isDimensionToken } from '../../css/syntax/parser';
import { segmentGraphemes, TextBounds } from '../../css/layout/text';
import { ImageElementContainer } from '../../dom/replaced-elements/image-element-container';
import { contentBox } from '../box-sizing';
import { CanvasElementContainer } from '../../dom/replaced-elements/canvas-element-container';
import { SVGElementContainer } from '../../dom/replaced-elements/svg-element-container';
import { ReplacedElementContainer } from '../../dom/replaced-elements';
import { IElementEffect, isClipEffect, isOpacityEffect, isTransformEffect } from '../effects';
import { contains } from '../../core/bitwise';
import { calculateGradientDirection, calculateRadius, processColorStops } from '../../css/types/functions/gradient';
import { FIFTY_PERCENT, getAbsoluteValue } from '../../css/types/length-percentage';
import { FontMetrics } from '../font-metrics';
import { Bounds } from '../../css/layout/bounds';
import { computeLineHeight } from '../../css/property-descriptors/line-height';
import { CHECKBOX, INPUT_COLOR, InputElementContainer, RADIO } from '../../dom/replaced-elements/input-element-container';
import { TextareaElementContainer } from '../../dom/elements/textarea-element-container';
import { SelectElementContainer } from '../../dom/elements/select-element-container';
import { IFrameElementContainer } from '../../dom/replaced-elements/iframe-element-container';
import { TextShadow } from '../../css/property-descriptors/text-shadow';
import { Context } from '../../core/context';
import { FallbackFontProvider } from '../../pdf/font-fallback';

export interface CanvasKitConfig {
    canvasKit: CanvasKit;
    canvas: SkiaCanvas;
    fontProvider: FontMgr;
}

export interface SkiaRenderOptions {
    scale: number;
    x: number;
    y: number;
    width: number;
    height: number;
    backgroundColor: Color | null;
    fallbackFontProvider?: FallbackFontProvider;
}

const MASK_OFFSET = 10000;

/**
 * Parsed font information from CSS styles
 */
export interface ParsedFontInfo {
    fontFamily: string[];
    fontSize: number;
    fontStyle: FontStyle;
    fontVariant: string;
}

class GlobalAlpha {
    private stack: number[] = [];
    constructor() {
        this.stack.push(1); // Initialize with default global alpha of 1
    }
    get value(): number {
        return this.stack[this.stack.length - 1] ?? 1;
    }
    push(value: number): void {
        this.stack.push(value);
    }
    pop(): number {
        if (this.stack.length > 1) {
            return this.stack.pop()!;
        }
        return 1; // Always keep at least the default value
    }
}

export class SkiaRenderer {
    canvas: SkiaCanvas;
    canvasKit: CanvasKit;
    private readonly _activeEffects: IElementEffect[] = [];
    private readonly fontMetrics: FontMetrics;
    private readonly fontProvider: FontMgr;
    private readonly globalAlpha: GlobalAlpha = new GlobalAlpha();

    constructor(private context: Context, ckConfig: CanvasKitConfig, private options: SkiaRenderOptions) {
        this.canvas = ckConfig.canvas;
        this.canvasKit = ckConfig.canvasKit;
        this.fontMetrics = new FontMetrics(document);
        this.fontProvider = ckConfig.fontProvider;
        this.canvas.scale(options.scale, options.scale);
        this.canvas.translate(-options.x, -options.y);
        this._activeEffects = [];
        this.context.logger.debug(
            `Skia renderer initialized (${options.width}x${options.height}) with scale ${options.scale}`
        );
    }

    private parseColor(color: Color): Float32Array {
        const colorString = asString(color);
        try {
            // Try using CanvasKit's built-in color parsing if available
            if (this.canvasKit.parseColorString) {
                return this.canvasKit.parseColorString(colorString);
            }
        } catch {
            // Fallback parsing
        }

        // Manual color parsing fallback
        if (colorString.startsWith('#')) {
            const hex = colorString.slice(1);
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            const a = hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
            return this.canvasKit.Color4f ? this.canvasKit.Color4f(r, g, b, a) : this.canvasKit.Color(r * 255, g * 255, b * 255, a);
        }

        // Parse rgba/rgb strings
        const rgbaMatch = colorString.match(/rgba?\(([^)]+)\)/);
        if (rgbaMatch) {
            const values = rgbaMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 3) {
                const r = values[0] / 255;
                const g = values[1] / 255;
                const b = values[2] / 255;
                const a = values.length > 3 ? values[3] : 1;
                return this.canvasKit.Color4f ? this.canvasKit.Color4f(r, g, b, a) : this.canvasKit.Color(values[0], values[1], values[2], a);
            }
        }

        // Default to black
        return this.canvasKit.Color4f ? this.canvasKit.Color4f(0, 0, 0, 1) : this.canvasKit.Color(0, 0, 0, 1);
    }

    /**
     * Parse a color and apply the current global alpha value
     */
    private parseColorWithAlpha(color: Color): Float32Array {
        const parsedColor = this.parseColor(color);
        return this.canvasKit.multiplyByAlpha(parsedColor, this.globalAlpha.value);
    }

    private createPaint(style: 'fill' | 'stroke' = 'fill'): SkiaPaint {
        const paint = new this.canvasKit.Paint();
        const paintStyleValue = style === 'fill' ?
            (this.canvasKit.PaintStyle?.Fill ?? this.canvasKit.PaintStyle.Fill) :
            (this.canvasKit.PaintStyle?.Stroke ?? this.canvasKit.PaintStyle.Stroke);

        paint.setStyle(paintStyleValue);
        if (paint.setAntiAlias) {
            paint.setAntiAlias(true);
        }
        return paint;
    }

    applyEffects(effects: IElementEffect[]): void {
        while (this._activeEffects.length) {
            this.popEffect();
        }

        effects.forEach((effect) => this.applyEffect(effect));
    }

    applyEffect(effect: IElementEffect): void {
        this.canvas.save();

        if (isOpacityEffect(effect)) {
            this.globalAlpha.push(effect.opacity);
        }

        if (isTransformEffect(effect)) {
            this.canvas.translate(effect.offsetX, effect.offsetY);
            // Create a 3x3 matrix for the transform
            const matrix = [
                effect.matrix[0], effect.matrix[2], effect.matrix[4],
                effect.matrix[1], effect.matrix[3], effect.matrix[5],
                0, 0, 1
            ];
            this.canvas.concat(matrix);
            this.canvas.translate(-effect.offsetX, -effect.offsetY);
        }

        if (isClipEffect(effect)) {
            const path = this.createSkiaPath(effect.path);
            this.canvas.clipPath(path, this.canvasKit.ClipOp.Intersect, true);
            path.delete();
        }

        this._activeEffects.push(effect);
    }

    popEffect(): void {
        const effect = this._activeEffects.pop();
        this.canvas.restore();
        if (effect && isOpacityEffect(effect)) {
            this.globalAlpha.pop();
        }
    }

    async renderStack(stack: StackingContext): Promise<void> {
        const styles = stack.element.container.styles;
        if (styles.isVisible()) {
            await this.renderStackContent(stack);
        }
    }

    async renderNode(paint: ElementPaint): Promise<void> {
        if (contains(paint.container.flags, 16 /* FLAGS.DEBUG_RENDER */)) {
            debugger;
        }

        if (paint.container.styles.isVisible()) {
            await this.renderNodeBackgroundAndBorders(paint);
            await this.renderNodeContent(paint);
        }
    }

    renderTextWithLetterSpacing(text: TextBounds, letterSpacing: number, baseline: number, paint: SkiaPaint, font: SkiaFont): void {
        if (letterSpacing === 0 && !this.areGlyphsMissing(font, text.text)) {
            this.canvas.drawText(text.text, text.bounds.left, text.bounds.top + baseline, paint, font);
        } else {
            const letters = segmentGraphemes(text.text);
            letters.reduce((left, letter) => {
                let fallbackFont = null;
                const glyphIDs = font.getGlyphIDs(letter);
                if (glyphIDs.length === 0 || glyphIDs.some(id => id === 0)) {   
                    // If glyphs are missing, use fallback font
                    const typeface = this.options.fallbackFontProvider?.getFallbackFontTypeface(letter);
                    if(typeface) {
                        fallbackFont = new this.canvasKit.Font(typeface, font.getSize());
                    }
                }
                const finalFont = fallbackFont ?? font;
                this.canvas.drawText(letter, left, text.bounds.top + baseline, paint, finalFont);
                // Calculate text width using CanvasKit's text measurement
                const widths = finalFont.getGlyphWidths(glyphIDs, paint);
                fallbackFont?.delete();
                const letterWidth = widths.length > 0 ? widths[0] : 0;
                return left + letterWidth + letterSpacing;
            }, text.bounds.left);
        }
    }

    /**
     * Parse CSS font styles into Skia-compatible font information
     */
    private parseFontStyle(styles: CSSParsedDeclaration): ParsedFontInfo {
        const fontVariant = styles.fontVariant
            .filter((variant) => variant === 'normal' || variant === 'small-caps')
            .join('');

        const fontFamily = fixIOSSystemFonts(styles.fontFamily);

        const fontSize = isDimensionToken(styles.fontSize)
            ? styles.fontSize.number
            : styles.fontSize.number;

        // Convert CSS font-weight to Skia FontWeight
        const fontWeight = this.mapCSSFontWeightToSkia(styles.fontWeight);

        // Convert CSS font-style to Skia FontSlant
        const fontSlant = this.mapCSSFontStyleToSkia(styles.fontStyle);

        // Handle font-variant mapping to style name if needed
        const skiaFontStyle: FontStyle = {
            weight: fontWeight,
            slant: fontSlant,
            // CanvasKit doesn't have direct width support in FontStyle, using default
        };

        return {
            fontFamily,
            fontSize,
            fontStyle: skiaFontStyle,
            fontVariant
        };
    }

    /**
     * Map CSS font-weight values to Skia FontWeight
     */
    private mapCSSFontWeightToSkia(fontWeight: string | number): any {
        if (typeof fontWeight === 'number') {
            if (fontWeight <= 100) return this.canvasKit.FontWeight?.Thin || this.canvasKit.FontWeight?.Normal;
            if (fontWeight <= 200) return this.canvasKit.FontWeight?.ExtraLight || this.canvasKit.FontWeight?.Normal;
            if (fontWeight <= 300) return this.canvasKit.FontWeight?.Light || this.canvasKit.FontWeight?.Normal;
            if (fontWeight <= 400) return this.canvasKit.FontWeight?.Normal;
            if (fontWeight <= 500) return this.canvasKit.FontWeight?.Medium || this.canvasKit.FontWeight?.Normal;
            if (fontWeight <= 600) return this.canvasKit.FontWeight?.SemiBold || this.canvasKit.FontWeight?.Bold;
            if (fontWeight <= 700) return this.canvasKit.FontWeight?.Bold;
            if (fontWeight <= 800) return this.canvasKit.FontWeight?.ExtraBold || this.canvasKit.FontWeight?.Bold;
            if (fontWeight <= 900) return this.canvasKit.FontWeight?.Black || this.canvasKit.FontWeight?.Bold;
            return this.canvasKit.FontWeight?.ExtraBlack || this.canvasKit.FontWeight?.Bold;
        }

        switch (fontWeight.toLowerCase()) {
            case 'thin': return this.canvasKit.FontWeight?.Thin || this.canvasKit.FontWeight?.Normal;
            case 'extralight':
            case 'extra-light': return this.canvasKit.FontWeight?.ExtraLight || this.canvasKit.FontWeight?.Normal;
            case 'light': return this.canvasKit.FontWeight?.Light || this.canvasKit.FontWeight?.Normal;
            case 'normal': return this.canvasKit.FontWeight?.Normal;
            case 'medium': return this.canvasKit.FontWeight?.Medium || this.canvasKit.FontWeight?.Normal;
            case 'semibold':
            case 'semi-bold': return this.canvasKit.FontWeight?.SemiBold || this.canvasKit.FontWeight?.Bold;
            case 'bold': return this.canvasKit.FontWeight?.Bold;
            case 'extrabold':
            case 'extra-bold': return this.canvasKit.FontWeight?.ExtraBold || this.canvasKit.FontWeight?.Bold;
            case 'black': return this.canvasKit.FontWeight?.Black || this.canvasKit.FontWeight?.Bold;
            case 'extrablack':
            case 'extra-black': return this.canvasKit.FontWeight?.ExtraBlack || this.canvasKit.FontWeight?.Bold;
            default: return this.canvasKit.FontWeight?.Normal;
        }
    }

    /**
     * Map CSS font-style values to Skia FontSlant
     */
    private mapCSSFontStyleToSkia(fontStyle: string): any {
        switch (fontStyle.toLowerCase()) {
            case 'italic': return this.canvasKit.FontSlant?.Italic || this.canvasKit.FontSlant?.Upright;
            case 'oblique': return this.canvasKit.FontSlant?.Oblique || this.canvasKit.FontSlant?.Italic || this.canvasKit.FontSlant?.Upright;
            case 'normal':
            default: return this.canvasKit.FontSlant?.Upright;
        }
    }

    /**
     * Create a Skia Font from CSS styles using the TypefaceFontProvider
     */
    private createSkiaFont(styles: CSSParsedDeclaration): SkiaFont {
        const fontInfo = this.parseFontStyle(styles);
        const font = new this.canvasKit.Font();

        // Set font size
        font.setSize(fontInfo.fontSize);

        // Try to get a typeface for each font family until one is found
        let typeface: Typeface | null = null;
        for (const family of [...fontInfo.fontFamily, 'Roboto']) {
            try {
                typeface = this.fontProvider.matchFamilyStyle(family, fontInfo.fontStyle);
                if (typeface) {
                    break;
                }
            } catch {
                // Continue to next font family
                continue;
            }
        }

        // Set the typeface if found
        if (typeface) {
            font.setTypeface(typeface);
        }

        // Set font properties
        if (font.setSubpixel) {
            font.setSubpixel(true);
        }

        return font;
    }

    renderTextNode(text: TextContainer, styles: CSSParsedDeclaration): void {
        const font = this.createSkiaFont(styles);
        const { baseline, middle } = this.fontMetrics.getMetrics(styles.fontFamily.join(', '), styles.fontSize.number.toString());
        const paintOrder = styles.paintOrder;

        text.textBounds.forEach((textBounds) => {
            // Don't draw empty text bounds
            if(textBounds.bounds.width <= 0 || textBounds.bounds.height <= 0) {
                return;
            }
            paintOrder.forEach((paintOrderLayer) => {
                switch (paintOrderLayer) {
                    case 0 /* PAINT_ORDER_LAYER.FILL */:
                        const fillPaint = this.createPaint('fill');
                        fillPaint.setColor(this.parseColorWithAlpha(styles.color));

                        this.renderTextWithLetterSpacing(textBounds, styles.letterSpacing, baseline, fillPaint, font);

                        const textShadows: TextShadow = styles.textShadow;
                        if (textShadows.length && textBounds.text.trim().length) {
                            textShadows
                                .slice(0)
                                .reverse()
                                .forEach((textShadow) => {
                                    const shadowPaint = fillPaint.copy();
                                    shadowPaint.setColor(this.parseColorWithAlpha(textShadow.color));

                                    this.canvas.save();
                                    this.canvas.translate(
                                        textShadow.offsetX.number * (this.options as any).scale,
                                        textShadow.offsetY.number * (this.options as any).scale
                                    );
                                    const blurEffect = this.canvasKit.MaskFilter.MakeBlur(this.canvasKit.BlurStyle.Normal,
                                        textShadow.blur.number / 2,
                                        false);
                                    shadowPaint.setMaskFilter(blurEffect);
                                    this.renderTextWithLetterSpacing(textBounds, styles.letterSpacing, baseline, shadowPaint, font);
                                    this.canvas.restore();
                                    shadowPaint.delete();
                                    blurEffect.delete();
                                });
                        }

                        if (styles.textDecorationLine.length) {
                            const decorationPaint = this.createPaint('fill');
                            decorationPaint.setColor(this.parseColorWithAlpha(styles.textDecorationColor || styles.color));

                            styles.textDecorationLine.forEach((textDecorationLine) => {
                                const rect: [number, number, number, number] = [0, 0, 0, 0];

                                switch (textDecorationLine) {
                                    case 1 /* TEXT_DECORATION_LINE.UNDERLINE */:
                                        rect[0] = textBounds.bounds.left;
                                        rect[1] = Math.round(textBounds.bounds.top + baseline);
                                        rect[2] = textBounds.bounds.left + textBounds.bounds.width;
                                        rect[3] = Math.round(textBounds.bounds.top + baseline) + 1;
                                        break;
                                    case 2 /* TEXT_DECORATION_LINE.OVERLINE */:
                                        rect[0] = textBounds.bounds.left;
                                        rect[1] = Math.round(textBounds.bounds.top);
                                        rect[2] = textBounds.bounds.left + textBounds.bounds.width;
                                        rect[3] = Math.round(textBounds.bounds.top) + 1;
                                        break;
                                    case 3 /* TEXT_DECORATION_LINE.LINE_THROUGH */:
                                        rect[0] = textBounds.bounds.left;
                                        rect[1] = Math.ceil(textBounds.bounds.top + middle);
                                        rect[2] = textBounds.bounds.left + textBounds.bounds.width;
                                        rect[3] = Math.ceil(textBounds.bounds.top + middle) + 1;
                                        break;
                                }

                                if (rect[2] > rect[0] && rect[3] > rect[1]) {
                                    this.canvas.drawRect(rect, decorationPaint);
                                }
                            });
                            decorationPaint.delete();
                        }
                        fillPaint.delete();
                        break;

                    case 1 /* PAINT_ORDER_LAYER.STROKE */:
                        if (styles.webkitTextStrokeWidth && textBounds.text.trim().length) {
                            const strokePaint = this.createPaint('stroke');
                            strokePaint.setColor(this.parseColorWithAlpha(styles.webkitTextStrokeColor));
                            strokePaint.setStrokeWidth(styles.webkitTextStrokeWidth);

                            this.renderTextWithLetterSpacing(textBounds, styles.letterSpacing, baseline, strokePaint, font);
                            strokePaint.delete();
                        }
                        break;
                }
            });
        });

        font.delete();
    }

    renderReplacedElement(
        container: ReplacedElementContainer,
        curves: BoundCurves,
        image: SkiaImage
    ): void {
        if (image && container.intrinsicWidth > 0 && container.intrinsicHeight > 0) {
            const box = contentBox(container);
            const path = this.createSkiaPath(calculatePaddingBoxPath(curves));

            this.canvas.save();
            this.canvas.clipPath(path, this.canvasKit.ClipOp.Intersect, true);

            const paint = this.createPaint('fill');

            this.canvas.drawImageRect(
                image,
                [0, 0, container.intrinsicWidth, container.intrinsicHeight],
                [box.left, box.top, box.left + box.width, box.top + box.height],
                paint
            );

            this.canvas.restore();
            paint.delete();
            path.delete();
        }
    }

    private createSkiaPath(paths: Path[]): SkiaPath {
        const skiaPath = new this.canvasKit.Path();
        this.formatSkiaPath(skiaPath, paths);
        return skiaPath;
    }

    async renderNodeContent(paint: ElementPaint): Promise<void> {
        this.applyEffects(paint.getEffects(4 /* EffectTarget.CONTENT */));
        const container = paint.container;
        const styles = container.styles;
        if (container.pdfTagNodeId) {
            this.canvasKit.SetPDFTagId(this.canvas, container.pdfTagNodeId);
        }
        for (const child of container.textNodes) {
            this.renderTextNode(child, styles);
        }

        if (container instanceof ImageElementContainer) {
            try {
                const cachedImage = await this.context.cache.match(container.src);
                const skiaImage = this.convertCanvasImageSourceToSkia(cachedImage);
                if (skiaImage) {
                    // Create simple curves from container bounds
                    const curves = new BoundCurves(container);
                    this.renderReplacedElement(container, curves, skiaImage);
                    skiaImage.delete();
                }
            } catch (e) {
                this.context.logger.error(`Error loading image ${container.src}`);
            }
        }

        if (container instanceof CanvasElementContainer) {
            try {
                const skiaImage = this.convertCanvasImageSourceToSkia(container.canvas);
                if (skiaImage) {
                    const curves = new BoundCurves(container);
                    this.renderReplacedElement(container, curves, skiaImage);
                    skiaImage.delete();
                }
            } catch (e) {
                this.context.logger.error(`Error converting canvas element`);
            }
        }

        if (container instanceof SVGElementContainer) {
            try {
                const cachedSvg = await this.context.cache.match(container.svg);
                // For SVG, we need to get the actual SVG element
                if (cachedSvg && cachedSvg instanceof SVGElement) {
                    const skiaImage = await this.convertSvgToSkia(cachedSvg);
                    if (skiaImage) {
                        const curves = new BoundCurves(container);
                        this.renderReplacedElement(container, curves, skiaImage);
                        skiaImage.delete();
                    }
                } else {
                    // Fallback: try to create SVG element from string
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(container.svg, 'image/svg+xml');
                    const svgElement = svgDoc.documentElement;
                    if (svgElement instanceof SVGElement) {
                        const skiaImage = await this.convertSvgToSkia(svgElement);
                        if (skiaImage) {
                            const curves = new BoundCurves(container);
                            this.renderReplacedElement(container, curves, skiaImage);
                            skiaImage.delete();
                        }
                    }
                }
            } catch (e) {
                this.context.logger.error(`Error loading svg ${container.svg.substring(0, 255)}`);
            }
        }

        if (container instanceof IFrameElementContainer && container.tree) {
            // Create a PictureRecorder to capture the iframe drawing commands
            const pictureRecorder = new this.canvasKit.PictureRecorder();

            // Begin recording with the iframe bounds
            const iframeBounds = [
                0, 0,
                container.width,
                container.height
            ];
            const iframeCanvas = pictureRecorder.beginRecording(iframeBounds);

            // Create a new SkiaRenderer for the iframe content
            const iframeRenderer = new SkiaRenderer(this.context, {
                canvasKit: this.canvasKit,
                canvas: iframeCanvas,
                fontProvider: this.fontProvider
            }, {
                scale: (this.options as any).scale,
                backgroundColor: container.backgroundColor,
                x: 0,
                y: 0,
                width: container.width,
                height: container.height
            });

            // Render the iframe content to the recorded canvas
            await iframeRenderer.render(container.tree);

            // Finish recording and get the picture
            const picture = pictureRecorder.finishRecordingAsPicture();

            // Draw the picture on the main canvas at the iframe's position
            this.canvas.save();
            this.canvas.translate(container.bounds.left, container.bounds.top);
            this.canvas.scale((container.bounds.width / container.width), (container.bounds.height / container.height));
            this.canvas.drawPicture(picture);
            this.canvas.restore();

            // Clean up
            picture.delete();
            pictureRecorder.delete();
        }

        if (container instanceof InputElementContainer) {
            const size = Math.min(container.bounds.width, container.bounds.height);

            if (container.type === CHECKBOX) {
                if (container.checked) {
                    const checkPath = new this.canvasKit.Path();
                    checkPath.moveTo(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79);
                    checkPath.lineTo(container.bounds.left + size * 0.16, container.bounds.top + size * 0.5549);
                    checkPath.lineTo(container.bounds.left + size * 0.27347, container.bounds.top + size * 0.44071);
                    checkPath.lineTo(container.bounds.left + size * 0.39694, container.bounds.top + size * 0.5649);
                    checkPath.lineTo(container.bounds.left + size * 0.72983, container.bounds.top + size * 0.23);
                    checkPath.lineTo(container.bounds.left + size * 0.84, container.bounds.top + size * 0.34085);
                    checkPath.close();

                    const paint = this.createPaint('fill');
                    paint.setColor(this.parseColorWithAlpha(INPUT_COLOR));

                    this.canvas.drawPath(checkPath, paint);

                    paint.delete();
                    checkPath.delete();
                }
            } else if (container.type === RADIO) {
                if (container.checked) {
                    const paint = this.createPaint('fill');
                    paint.setColor(this.parseColorWithAlpha(INPUT_COLOR));

                    this.canvas.drawCircle(
                        container.bounds.left + size / 2,
                        container.bounds.top + size / 2,
                        size / 4,
                        paint
                    );

                    paint.delete();
                }
            }
        }

        if (isTextInputElement(container) && container.value.length) {
            const font = this.createSkiaFont(styles);
            const { baseline } = this.fontMetrics.getMetrics(styles.fontFamily.join(', '), styles.fontSize.number.toString());

            const paint = this.createPaint('fill');
            paint.setColor(this.parseColorWithAlpha(styles.color));

            const bounds = contentBox(container);
            let x = 0;

            switch (container.styles.textAlign) {
                case 1 /* TEXT_ALIGN.CENTER */:
                    x += bounds.width / 2;
                    break;
                case 2 /* TEXT_ALIGN.RIGHT */:
                    x += bounds.width;
                    break;
            }

            const textBounds = bounds.add(x, 0, 0, -bounds.height / 2 + 1);

            this.canvas.save();
            this.canvas.clipRect([bounds.left, bounds.top, bounds.left + bounds.width, bounds.top + bounds.height], this.canvasKit.ClipOp.Intersect, true);

            this.renderTextWithLetterSpacing(
                new TextBounds(container.value, textBounds),
                styles.letterSpacing,
                baseline,
                paint,
                font
            );

            this.canvas.restore();
            paint.delete();
            font.delete();
        }

        if (contains(container.styles.display, 2048 /* DISPLAY.LIST_ITEM */)) {
            if (container.styles.listStyleImage !== null) {
                const img = container.styles.listStyleImage;
                if (img.type === 0 /* CSSImageType.URL */) {
                    const url = (img as CSSURLImage).url;
                    try {
                        const cachedImage = await this.context.cache.match(url);
                        const skiaImage = this.convertCanvasImageSourceToSkia(cachedImage);
                        if (skiaImage) {
                            // Position the list marker image
                            const markerSize = Math.min(
                                computeLineHeight(styles.lineHeight, styles.fontSize.number),
                                container.bounds.width
                            );

                            const bounds = new Bounds(
                                container.bounds.left - markerSize - 5,
                                container.bounds.top + getAbsoluteValue(container.styles.paddingTop, container.bounds.width),
                                markerSize,
                                markerSize
                            );

                            const paint = this.createPaint('fill');
                            this.canvas.drawImageRect(
                                skiaImage,
                                [0, 0, skiaImage.width(), skiaImage.height()],
                                [bounds.left, bounds.top, bounds.left + bounds.width, bounds.top + bounds.height],
                                paint
                            );

                            paint.delete();
                            skiaImage.delete();
                        }
                    } catch (e) {
                        this.context.logger.error(`Error loading list-style-image ${url}`);
                    }
                }
            } else if (paint.listValue && container.styles.listStyleType !== -1 /* LIST_STYLE_TYPE.NONE */) {
                const font = this.createSkiaFont(styles);
                const listPaint = this.createPaint('fill');
                listPaint.setColor(this.parseColorWithAlpha(styles.color));
                const textBounds = container.textNodes[0]?.textBounds[0]?.bounds
                    ?? container.elements[0]?.bounds; // Try to get bounds from first text node or element
                const bounds = new Bounds(
                    container.bounds.left - 16, // Adjust left position for list marker
                    textBounds?.top ?? container.bounds.top + getAbsoluteValue(container.styles.paddingTop, container.bounds.width),
                    container.bounds.width,
                    computeLineHeight(styles.lineHeight, styles.fontSize.number) / 2 + 1
                );

                this.renderTextWithLetterSpacing(
                    new TextBounds(paint.listValue, bounds),
                    styles.letterSpacing,
                    computeLineHeight(styles.lineHeight, styles.fontSize.number) / 2 + 2,
                    listPaint,
                    font
                );

                listPaint.delete();
                font.delete();
            }
        }
        if (container.pdfTagNodeId) {
            this.canvasKit.SetPDFTagId(this.canvas, 0);
        }
    }

    async renderStackContent(stack: StackingContext): Promise<void> {
        if (contains(stack.element.container.flags, 16 /* FLAGS.DEBUG_RENDER */)) {
            debugger;
        }

        // https://www.w3.org/TR/css-position-3/#painting-order
        // 1. the background and borders of the element forming the stacking context.
        await this.renderNodeBackgroundAndBorders(stack.element);

        // 2. the child stacking contexts with negative stack levels (most negative first).
        for (const child of stack.negativeZIndex) {
            await this.renderStack(child);
        }

        // 3. For all its in-flow, non-positioned, block-level descendants in tree order:
        await this.renderNodeContent(stack.element);

        for (const child of stack.nonInlineLevel) {
            await this.renderNode(child);
        }

        // 4. All non-positioned floating descendants, in tree order.
        for (const child of stack.nonPositionedFloats) {
            await this.renderStack(child);
        }

        // 5. the in-flow, inline-level, non-positioned descendants, including inline tables and inline blocks.
        for (const child of stack.nonPositionedInlineLevel) {
            await this.renderStack(child);
        }
        for (const child of stack.inlineLevel) {
            await this.renderNode(child);
        }

        // 6. All positioned, opacity or transform descendants, in tree order
        for (const child of stack.zeroOrAutoZIndexOrTransformedOrOpacity) {
            await this.renderStack(child);
        }

        // 7. Stacking contexts formed by positioned descendants with z-indices greater than or equal to 1
        for (const child of stack.positiveZIndex) {
            await this.renderStack(child);
        }
    }

    mask(paths: Path[]): void {
        const maskPath = new this.canvasKit.Path();
        maskPath.addRect([0, 0, (this.options as any).width, (this.options as any).height]);

        // Add the mask paths (reversed)
        const reversedPaths = paths.slice(0).reverse();
        this.formatSkiaPath(maskPath, reversedPaths);

        this.canvas.clipPath(maskPath, this.canvasKit.ClipOp.Intersect, true);
        maskPath.delete();
    }

    path(paths: Path[]): SkiaPath {
        const skiaPath = new this.canvasKit.Path();
        this.formatSkiaPath(skiaPath, paths);
        return skiaPath;
    }

    formatSkiaPath(skiaPath: SkiaPath, paths: Path[]): void {
        paths.forEach((point, index) => {
            const start: Vector = isBezierCurve(point) ? point.start : point;
            if (index === 0) {
                skiaPath.moveTo(start.x, start.y);
            } else {
                skiaPath.lineTo(start.x, start.y);
            }

            if (isBezierCurve(point)) {
                const curve = point as BezierCurve;
                skiaPath.cubicTo(
                    curve.startControl.x,
                    curve.startControl.y,
                    curve.endControl.x,
                    curve.endControl.y,
                    curve.end.x,
                    curve.end.y
                );
            }
        });
    }

    renderRepeat(path: Path[], shader: SkiaShader, offsetX: number, offsetY: number): void {
        const skiaPath = this.createSkiaPath(path);
        const paint = this.createPaint('fill');
        paint.setShader(shader);

        this.canvas.save();
        this.canvas.translate(offsetX, offsetY);
        this.canvas.drawPath(skiaPath, paint);
        this.canvas.restore();

        paint.delete();
        skiaPath.delete();
    }

    async renderBackgroundImage(container: ElementContainer): Promise<void> {
        let index = container.styles.backgroundImage.length - 1;
        for (const backgroundImage of container.styles.backgroundImage.slice(0).reverse()) {
            if (backgroundImage.type === 0 /* CSSImageType.URL */) {
                const url = (backgroundImage as CSSURLImage).url;
                try {
                    const cachedImage = await this.context.cache.match(url);
                    if (cachedImage) {
                        const [path, x, y, width, height] = calculateBackgroundRendering(container, index, [
                            cachedImage.width,
                            cachedImage.height,
                            cachedImage.width / cachedImage.height
                        ]);
                        const skiaImage = this.convertCanvasImageSourceToSkia(this.resizeImage(cachedImage, width, height));
                        if (skiaImage) {
                            const shader = skiaImage.makeShaderCubic(
                                this.canvasKit.TileMode.Repeat,
                                this.canvasKit.TileMode.Repeat,
                                1 / 3, 1 / 3,
                                this.canvasKit.Matrix.identity()
                            );

                            const skiaPath = this.createSkiaPath(path);
                            const paint = this.createPaint('fill');
                            paint.setShader(shader);
                            this.canvas.save();
                            this.canvas.translate(x, y);
                            this.canvas.drawPath(skiaPath, paint);
                            this.canvas.restore();
                            shader.delete();
                            paint.delete();
                            skiaPath.delete();
                            skiaImage.delete();
                        }
                    }
                } catch (e) {
                    this.context.logger.error(`Error loading background-image ${url}`);
                }
            } else if (isLinearGradient(backgroundImage)) {
                const [path, x, y, width, height] = calculateBackgroundRendering(container, index, [null, null, null]);
                const [lineLength, x0, x1, y0, y1] = calculateGradientDirection(backgroundImage.angle, width, height);

                const colors: Float32Array[] = [];
                const positions: number[] = [];

                processColorStops(backgroundImage.stops, lineLength).forEach((colorStop) => {
                    colors.push(this.parseColor(colorStop.color));
                    positions.push(colorStop.stop);
                });

                const shader = this.canvasKit.Shader?.MakeLinearGradient ?
                    this.canvasKit.Shader.MakeLinearGradient(
                        [x0, y0],
                        [x1, y1],
                        colors,
                        positions,
                        this.canvasKit.TileMode.Repeat
                    ) : null;

                if (width > 0 && height > 0 && shader) {
                    this.renderRepeat(path, shader, x, y);
                    shader.delete();
                }
            } else if (isRadialGradient(backgroundImage)) {
                const [path, left, top, width, height] = calculateBackgroundRendering(container, index, [
                    null,
                    null,
                    null
                ]);
                const position = backgroundImage.position.length === 0 ? [FIFTY_PERCENT] : backgroundImage.position;
                const x = getAbsoluteValue(position[0], width);
                const y = getAbsoluteValue(position[position.length - 1], height);

                const [rx, ry] = calculateRadius(backgroundImage, x, y, width, height);
                if (rx > 0 && ry > 0) {
                    const colors: Float32Array[] = [];
                    const positions: number[] = [];

                    processColorStops(backgroundImage.stops, rx * 2).forEach((colorStop) => {
                        colors.push(this.parseColor(colorStop.color));
                        positions.push(colorStop.stop);
                    });

                    const shader = this.canvasKit.Shader?.MakeRadialGradient ?
                        this.canvasKit.Shader.MakeRadialGradient(
                            [left + x, top + y],
                            rx,
                            colors,
                            positions,
                            this.canvasKit.TileMode.Repeat
                        ) : null;

                    if (shader) {
                        const skiaPath = this.createSkiaPath(path);
                        const paint = this.createPaint('fill');
                        paint.setShader(shader);

                        if (rx !== ry) {
                            // transforms for elliptical radial gradient
                            const midX = container.bounds.left + 0.5 * container.bounds.width;
                            const midY = container.bounds.top + 0.5 * container.bounds.height;
                            const f = ry / rx;
                            const invF = 1 / f;

                            this.canvas.save();
                            this.canvas.translate(midX, midY);
                            // Create a 3x3 matrix for the transform
                            const scaleMatrix = [1, 0, 0, 0, f, 0, 0, 0, 1];
                            this.canvas.concat(scaleMatrix);
                            this.canvas.translate(-midX, -midY);

                            this.canvas.drawRect([left, invF * (top - midY) + midY, left + width, invF * (top - midY) + midY + height * invF], paint);
                            this.canvas.restore();
                        } else {
                            this.canvas.drawPath(skiaPath, paint);
                        }

                        paint.delete();
                        skiaPath.delete();
                        shader.delete();
                    }
                }
            }
            index--;
        }
    }

    renderSolidBorder(color: Color, side: number, curvePoints: BoundCurves): void {
        const path = this.createSkiaPath(parsePathForBorder(curvePoints, side));
        const paint = this.createPaint('fill');
        paint.setColor(this.parseColorWithAlpha(color));

        this.canvas.drawPath(path, paint);

        paint.delete();
        path.delete();
    }

    async renderDoubleBorder(color: Color, width: number, side: number, curvePoints: BoundCurves): Promise<void> {
        if (width < 3) {
            this.renderSolidBorder(color, side, curvePoints);
            return;
        }

        const outerPath = this.createSkiaPath(parsePathForBorderDoubleOuter(curvePoints, side));
        const innerPath = this.createSkiaPath(parsePathForBorderDoubleInner(curvePoints, side));

        const paint = this.createPaint('fill');
        paint.setColor(this.parseColorWithAlpha(color));

        this.canvas.drawPath(outerPath, paint);
        this.canvas.drawPath(innerPath, paint);

        paint.delete();
        outerPath.delete();
        innerPath.delete();
    }

    async renderNodeBackgroundAndBorders(paint: ElementPaint): Promise<void> {
        this.applyEffects(paint.getEffects(2 /* EffectTarget.BACKGROUND_BORDERS */));
        const styles = paint.container.styles;
        const hasBackground = !isTransparent(styles.backgroundColor) || styles.backgroundImage.length;

        const borders = [
            { style: styles.borderTopStyle, color: styles.borderTopColor, width: styles.borderTopWidth },
            { style: styles.borderRightStyle, color: styles.borderRightColor, width: styles.borderRightWidth },
            { style: styles.borderBottomStyle, color: styles.borderBottomColor, width: styles.borderBottomWidth },
            { style: styles.borderLeftStyle, color: styles.borderLeftColor, width: styles.borderLeftWidth }
        ];

        const backgroundPaintingArea = calculateBackgroundCurvedPaintingArea(
            getBackgroundValueForIndex(styles.backgroundClip, 0),
            paint.curves
        );

        if (hasBackground || styles.boxShadow.length) {
            this.canvas.save();
            const backgroundPath = this.createSkiaPath(backgroundPaintingArea);
            this.canvas.clipPath(backgroundPath, this.canvasKit.ClipOp.Intersect, true);

            if (!isTransparent(styles.backgroundColor)) {
                const bgPaint = this.createPaint('fill');
                bgPaint.setColor(this.parseColorWithAlpha(styles.backgroundColor));

                this.canvas.drawPath(backgroundPath, bgPaint);
                bgPaint.delete();
            }

            await this.renderBackgroundImage(paint.container);
            this.canvas.restore();
            backgroundPath.delete();

            // Box shadows
            styles.boxShadow
                .slice(0)
                .reverse()
                .forEach((shadow) => {
                    this.canvas.save();
                    const borderBoxArea = calculateBorderBoxPath(paint.curves);
                    const maskOffset = shadow.inset ? 0 : MASK_OFFSET;
                    const shadowPaintingArea = transformPath(
                        borderBoxArea,
                        -maskOffset + (shadow.inset ? 1 : -1) * shadow.spread.number,
                        (shadow.inset ? 1 : -1) * shadow.spread.number,
                        shadow.spread.number * (shadow.inset ? -2 : 2),
                        shadow.spread.number * (shadow.inset ? -2 : 2)
                    );

                    if (shadow.inset) {
                        const borderPath = this.createSkiaPath(borderBoxArea);
                        this.canvas.clipPath(borderPath, this.canvasKit.ClipOp.Intersect, true);
                        this.mask(shadowPaintingArea);
                        borderPath.delete();
                    } else {
                        this.mask(borderBoxArea);
                        const shadowPath = this.createSkiaPath(shadowPaintingArea);
                        this.canvas.clipPath(shadowPath, this.canvasKit.ClipOp.Intersect, true);
                        shadowPath.delete();
                    }

                    const shadowPaint = this.createPaint('fill');
                    if (shadow.inset) {
                        shadowPaint.setColor(this.parseColorWithAlpha(shadow.color));
                    } else {
                        shadowPaint.setColor(this.canvasKit.multiplyByAlpha(this.canvasKit.Color4f(0, 0, 0, 1), this.globalAlpha.value));
                    }

                    const blurEffect = this.canvasKit.MaskFilter.MakeBlur(this.canvasKit.BlurStyle.Normal,
                        shadow.blur.number / 2,
                        false);
                    shadowPaint.setMaskFilter(blurEffect);
                    this.canvas.save();
                    this.canvas.translate(
                        shadow.offsetX.number + maskOffset,
                        shadow.offsetY.number
                    );

                    const shadowPath = this.createSkiaPath(shadowPaintingArea);
                    this.canvas.drawPath(shadowPath, shadowPaint);
                    this.canvas.restore();

                    shadowPaint.delete();
                    shadowPath.delete();
                    blurEffect.delete();
                    this.canvas.restore();
                });
        }

        let side = 0;
        for (const border of borders) {
            if (border.style !== 0 /* BORDER_STYLE.NONE */ && !isTransparent(border.color) && border.width > 0) {
                if (border.style === 2 /* BORDER_STYLE.DASHED */) {
                    this.renderDashedDottedBorder(
                        border.color,
                        border.width,
                        side,
                        paint.curves,
                        2 /* BORDER_STYLE.DASHED */
                    );
                } else if (border.style === 3 /* BORDER_STYLE.DOTTED */) {
                    this.renderDashedDottedBorder(
                        border.color,
                        border.width,
                        side,
                        paint.curves,
                        3 /* BORDER_STYLE.DOTTED */
                    );
                } else if (border.style === 4 /* BORDER_STYLE.DOUBLE */) {
                    await this.renderDoubleBorder(border.color, border.width, side, paint.curves);
                } else {
                    this.renderSolidBorder(border.color, side, paint.curves);
                }
            }
            side++;
        }
    }

    renderDashedDottedBorder(
        color: Color,
        width: number,
        side: number,
        curvePoints: BoundCurves,
        style: BORDER_STYLE
    ): void {
        this.canvas.save();

        const strokePaths = parsePathForBorderStroke(curvePoints, side);
        const boxPaths = parsePathForBorder(curvePoints, side);

        const paint = this.createPaint('stroke');
        paint.setColor(this.parseColorWithAlpha(color));

        if (style === 2 /* BORDER_STYLE.DASHED */) {
            const boxPath = this.createSkiaPath(boxPaths);
            this.canvas.clipPath(boxPath, this.canvasKit.ClipOp.Intersect, true);
            boxPath.delete();
        }

        let startX, startY, endX, endY;
        if (isBezierCurve(boxPaths[0])) {
            startX = (boxPaths[0] as BezierCurve).start.x;
            startY = (boxPaths[0] as BezierCurve).start.y;
        } else {
            startX = (boxPaths[0] as Vector).x;
            startY = (boxPaths[0] as Vector).y;
        }
        if (isBezierCurve(boxPaths[1])) {
            endX = (boxPaths[1] as BezierCurve).end.x;
            endY = (boxPaths[1] as BezierCurve).end.y;
        } else {
            endX = (boxPaths[1] as Vector).x;
            endY = (boxPaths[1] as Vector).y;
        }

        let length;
        if (side === 0 || side === 2) {
            length = Math.abs(startX - endX);
        } else {
            length = Math.abs(startY - endY);
        }

        let dashLength = width < 3 ? width * 3 : width * 2;
        let spaceLength = width < 3 ? width * 2 : width;
        if (style === 3 /* BORDER_STYLE.DOTTED */) {
            dashLength = width;
            spaceLength = width;
        }

        // Calculate dash and space lengths for border patterns
        if (length <= dashLength * 2) {
            // Too short for dash pattern
        } else if (length <= dashLength * 2 + spaceLength) {
            const multiplier = length / (2 * dashLength + spaceLength);
            dashLength *= multiplier;
            spaceLength *= multiplier;
        } else {
            const numberOfDashes = Math.floor((length + spaceLength) / (dashLength + spaceLength));
            const minSpace = (length - numberOfDashes * dashLength) / (numberOfDashes - 1);
            const maxSpace = (length - (numberOfDashes + 1) * dashLength) / numberOfDashes;
            spaceLength =
                maxSpace <= 0 || Math.abs(spaceLength - minSpace) < Math.abs(spaceLength - maxSpace)
                    ? minSpace
                    : maxSpace;
        }

        let pathEffect;
        if (style === 3 /* BORDER_STYLE.DOTTED */) {
            paint.setStrokeWidth(width);
            pathEffect = this.canvasKit.PathEffect.MakeDash([0, dashLength + spaceLength], 0);
            paint.setPathEffect(pathEffect);
        } else {
            paint.setStrokeWidth(width * 2 + 1.1);
            pathEffect = this.canvasKit.PathEffect.MakeDash([dashLength, spaceLength], 0);
            paint.setPathEffect(pathEffect);
        }

        const strokePath = style === 3 /* BORDER_STYLE.DOTTED */ ?
            this.createSkiaPath(strokePaths) :
            this.createSkiaPath(boxPaths.slice(0, 2));

        this.canvas.drawPath(strokePath, paint);

        paint.delete();
        strokePath.delete();
        pathEffect?.delete();
        this.canvas.restore();
    }

    private convertCanvasImageSourceToSkia(src: CanvasImageSource): SkiaImage | null {
        try {
            // Use CanvasKit's MakeImageFromCanvasImageSource for direct conversion
            // Supports HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageBitmap, OffscreenCanvas
            const skiaImage = this.canvasKit.MakeImageFromCanvasImageSource(src);
            if (!skiaImage) {
                const srcType = src.constructor.name;
                this.context.logger.error(`MakeImageFromCanvasImageSource failed for ${srcType}`);
                return null;
            }

            return skiaImage;
        } catch (error) {
            const srcType = src.constructor.name;
            this.context.logger.error(`Failed to convert ${srcType} to SkiaImage: ${error}`);
            return null;
        }
    }

    private async convertSvgToSkia(svgElement: SVGElement): Promise<SkiaImage | null> {
        try {
            // SVGElement is not directly supported by MakeImageFromCanvasImageSource,
            // so we continue using the buffer-based approach for SVG conversion
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                this.context.logger.error('Failed to get 2D context for SVG conversion');
                return null;
            }

            // Get SVG dimensions
            const svgRect = svgElement.getBoundingClientRect();
            tempCanvas.width = svgRect.width || 100;
            tempCanvas.height = svgRect.height || 100;

            // Convert SVG to data URL
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = async () => {
                    // Draw SVG image to canvas
                    tempCtx.drawImage(img, 0, 0);

                    // Get image data and convert to SkiaImage
                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

                    const skiaImage = this.canvasKit.MakeImageFromEncoded(imageData.data);
                    if (!skiaImage) {
                        // Fallback: try creating from raw pixel data
                        const info = {
                            width: tempCanvas.width,
                            height: tempCanvas.height,
                            alphaType: this.canvasKit.AlphaType.Unpremul,
                            colorType: this.canvasKit.ColorType.RGBA_8888,
                            colorSpace: this.canvasKit.ColorSpace.SRGB
                        };
                        resolve(this.canvasKit.MakeImage(info, imageData.data, tempCanvas.width * 4));
                    } else {
                        resolve(skiaImage);
                    }

                    URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                    this.context.logger.error('Failed to load SVG as image');
                    URL.revokeObjectURL(url);
                    resolve(null);
                };
                img.src = url;
            });
        } catch (error) {
            this.context.logger.error(`Failed to convert SVG to SkiaImage: ${error}`);
            return null;
        }
    }

    async render(element: ElementContainer): Promise<void> {
        if ((this.options as any).backgroundColor) {
            const bgPaint = this.createPaint('fill');
            bgPaint.setColor(this.parseColorWithAlpha((this.options as any).backgroundColor));

            this.canvas.drawRect([
                (this.options as any).x,
                (this.options as any).y,
                (this.options as any).x + (this.options as any).width,
                (this.options as any).y + (this.options as any).height
            ], bgPaint);

            bgPaint.delete();
        }

        const stack = parseStackingContexts(element);
        await this.renderStack(stack);
        this.applyEffects([]);
    }
    resizeImage(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement | HTMLImageElement {
        if (image.width === width && image.height === height) {
            return image;
        }

        const ownerDocument = image.ownerDocument ?? document;
        const canvas = ownerDocument.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
        return canvas;
    }
    private areGlyphsMissing(font: SkiaFont, text: string): boolean {
        // Check if the font has glyphs for the text
        const glyphs = font.getGlyphIDs(text);
        return glyphs.length === 0 || glyphs.some((glyph) => glyph === 0);
    }
}

const isTextInputElement = (
    container: ElementContainer
): container is InputElementContainer | TextareaElementContainer | SelectElementContainer => {
    if (container instanceof TextareaElementContainer) {
        return true;
    } else if (container instanceof SelectElementContainer) {
        return true;
    } else if (container instanceof InputElementContainer && container.type !== RADIO && container.type !== CHECKBOX) {
        return true;
    }
    return false;
};

const calculateBackgroundCurvedPaintingArea = (clip: BACKGROUND_CLIP, curves: BoundCurves): Path[] => {
    switch (clip) {
        case 0 /* BACKGROUND_CLIP.BORDER_BOX */:
            return calculateBorderBoxPath(curves);
        case 2 /* BACKGROUND_CLIP.CONTENT_BOX */:
            return calculateContentBoxPath(curves);
        case 1 /* BACKGROUND_CLIP.PADDING_BOX */:
        default:
            return calculatePaddingBoxPath(curves);
    }
};

// see https://github.com/niklasvh/html2canvas/pull/2645
const iOSBrokenFonts = ['-apple-system', 'system-ui'];

const fixIOSSystemFonts = (fontFamilies: string[]): string[] => {
    return /iPhone OS 15_(0|1)/.test(window.navigator.userAgent)
        ? fontFamilies.filter((fontFamily) => iOSBrokenFonts.indexOf(fontFamily) === -1)
        : fontFamilies;
};
