import { Font, Typeface } from "@rollerbird/canvaskit-wasm-pdf";
import { SkiaFontCollection } from "../../fonts/font-collection";
import { FontFamilyClass, FontStylePojo } from "../../fonts/interfaces";
import { CSSParsedDeclaration } from "../../css";
import { isDimensionToken } from "../../css/syntax/parser";

/**
 * Parsed font information from CSS styles
 */
export interface ParsedFontInfo {
    fontFamily: string[];
    fontSize: number;
    fontStyle: FontStylePojo;
    fontVariant: string;
}

export function createSkiaFont(styles: CSSParsedDeclaration, fontCollection:SkiaFontCollection): Font {
    const fontInfo = parseFontStyle(styles);
    // Try to get a typeface for each font family until one is found
    let typeface: Typeface | null = null;
    const fallbackFontFamilyClasses = (['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'fangsong'] as FontFamilyClass[])
        .filter(family => fontInfo.fontFamily.includes(family));
    const fallbackFontFamilies = fontCollection.getFallbackFontFamilies(fallbackFontFamilyClasses);
    for (const family of [...fontInfo.fontFamily, ...fallbackFontFamilies]) {
        try {
            typeface = fontCollection.fontMgr.matchFamilyStyle(family, fontInfo.fontStyle as any);
            if (typeface) {
                break;
            }
        } catch {
            // Continue to next font family
            continue;
        }
    }
    if (!typeface) {
        return fontCollection.emptyFont; // Return empty font if no typeface found
    }
    return fontCollection.getFont(typeface, fontInfo.fontSize);
}

/**
 * Parse CSS font styles into Skia-compatible font information
 */
export function parseFontStyle(styles: CSSParsedDeclaration): ParsedFontInfo {
    const fontVariant = styles.fontVariant
        .filter((variant) => variant === 'normal' || variant === 'small-caps')
        .join('');

    const fontFamily = fixIOSSystemFonts(styles.fontFamily);

    const fontSize = isDimensionToken(styles.fontSize)
        ? styles.fontSize.number
        : styles.fontSize.number;

    // Convert CSS font-weight to Skia FontWeight
    const fontWeight = mapCSSFontWeightToSkia(styles.fontWeight);

    // Convert CSS font-style to Skia FontSlant
    const fontSlant = mapCSSFontStyleToSkia(styles.fontStyle);

    // Handle font-variant mapping to style name if needed
    const skiaFontStyle: FontStylePojo = {
        weight: fontWeight,
        width: 0, // CanvasKit doesn't have direct width support in FontStyle, using default
        slant: fontSlant
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
export function mapCSSFontWeightToSkia(fontWeight: string | number): any {
    if (typeof fontWeight === 'number') {
        return fontWeight;
    }

    switch (fontWeight.toLowerCase()) {
        case 'thin': return 100;
        case 'extralight':
        case 'extra-light': return 200;
        case 'light': return 300;
        case 'normal': return 400;
        case 'medium': return 500;
        case 'semibold':
        case 'semi-bold': return 600;
        case 'bold': return 700;
        case 'extrabold':
        case 'extra-bold': return 800;
        case 'black': return 900;
        case 'extrablack':
        case 'extra-black': return 1000;
        default: return 400;
    }
}

/**
 * Map CSS font-style values to Skia FontSlant
 */
export function mapCSSFontStyleToSkia(fontStyle: string): any {
    switch (fontStyle.toLowerCase()) {
        case 'italic': return 1;
        case 'oblique': return 2;
        case 'normal':
        default: return 0;
    }
}

// see https://github.com/niklasvh/html2canvas/pull/2645
const iOSBrokenFonts = ['-apple-system', 'system-ui'];

const fixIOSSystemFonts = (fontFamilies: string[]): string[] => {
    return /iPhone OS 15_(0|1)/.test(window.navigator.userAgent)
        ? fontFamilies.filter((fontFamily) => iOSBrokenFonts.indexOf(fontFamily) === -1)
        : fontFamilies;
};

export function getFinalFont(text: string, styles: CSSParsedDeclaration, originalFont: Font, fontCollection: SkiaFontCollection): Font {
    let finalFont = originalFont;
    // Check if the font has glyphs for the text
    const glyphIDs = originalFont.getGlyphIDs(text);
    if (glyphIDs.some(id => id === 0)) {
        const fontInfo = parseFontStyle(styles);
        // If any glyph is missing, try to find a fallback font
        const typeface =fontCollection.getFallbackFontTypeface(text, fontInfo.fontStyle);
        if(typeface) {
            // Create a new font with the fallback typeface
            finalFont =  fontCollection.getFont(typeface, originalFont.getSize());
        }
    }
    return finalFont;
}

