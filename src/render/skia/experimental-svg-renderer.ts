import { CanvasKit, Paint, Font } from "@rollerbird/canvaskit-wasm-pdf";
import { SkiaRenderer } from "./skia-renderer";
import { SVGElementContainer } from "../../dom/replaced-elements/svg-element-container";
import { SkiaFontCollection } from "../../fonts/font-collection";
import { mapCSSFontWeightToSkia, mapCSSFontStyleToSkia } from "./skia-font";

export interface SVGStyleContext {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  letterSpacing: number;
  textAnchor: string;
  dominantBaseline: string;
}

const DEFAULT_STYLE_CONTEXT: SVGStyleContext = {
  fill: "#000000",
  fillOpacity: 1.0,
  stroke: "none",
  strokeWidth: 1.0,
  strokeOpacity: 1.0,
  fontSize: 16,
  fontWeight: "normal",
  fontFamily: "sans-serif",
  letterSpacing: 0,
  textAnchor: "start",
  dominantBaseline: "baseline",
};

/**
 * Experimental direct Skia vector SVG renderer.
 * Renders SVG elements directly to Skia vector paths and typography.
 */
export async function renderExperimentalSVG(
  renderer: SkiaRenderer,
  container: SVGElementContainer
): Promise<void> {
  const canvasKit = renderer.canvasKit;
  const canvas = renderer.canvas;

  // Extract SVGElement from container.svgNode or decode embedded data URI string
  let svgElement: SVGElement | null = container.svgNode || null;

  if (!svgElement && typeof container.svg === "string") {
    let svgRaw = container.svg;
    if (svgRaw.startsWith("data:image/svg+xml,")) {
      svgRaw = decodeURIComponent(
        svgRaw.substring("data:image/svg+xml,".length)
      );
    } else if (svgRaw.startsWith("data:image/svg+xml;utf8,")) {
      svgRaw = decodeURIComponent(
        svgRaw.substring("data:image/svg+xml;utf8,".length)
      );
    } else if (svgRaw.startsWith("data:image/svg+xml;base64,")) {
      try {
        svgRaw = atob(svgRaw.substring("data:image/svg+xml;base64,".length));
      } catch {
        svgRaw = container.svg;
      }
    }

    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgRaw, "image/svg+xml");
      if (svgDoc && svgDoc.documentElement) {
        svgElement = svgDoc.documentElement as unknown as SVGElement;
      }
    } catch {
      svgElement = null;
    }
  } else if (
    !svgElement &&
    container.svg &&
    typeof container.svg === "object"
  ) {
    svgElement = container.svg as SVGElement;
  }

  if (!svgElement) {
    return;
  }

  // Parse viewBox and dimensions
  const viewBoxAttr = svgElement.getAttribute("viewBox");
  let viewBox = { x: 0, y: 0, width: 0, height: 0 };
  if (viewBoxAttr) {
    const parts = viewBoxAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  const containerWidth = container.bounds.width;
  const containerHeight = container.bounds.height;
  const containerLeft = container.bounds.left;
  const containerTop = container.bounds.top;

  canvas.save();

  // Position at container bounds
  canvas.translate(containerLeft, containerTop);

  // Apply viewBox scaling if available
  if (
    viewBox.width > 0 &&
    viewBox.height > 0 &&
    containerWidth > 0 &&
    containerHeight > 0
  ) {
    const scaleX = containerWidth / viewBox.width;
    const scaleY = containerHeight / viewBox.height;
    canvas.scale(scaleX, scaleY);
    canvas.translate(-viewBox.x, -viewBox.y);
  }

  // Render root SVG node recursively
  renderSVGNode(canvasKit, canvas, renderer, svgElement, DEFAULT_STYLE_CONTEXT);

  canvas.restore();
}

function renderSVGNode(
  canvasKit: CanvasKit,
  canvas: any,
  renderer: SkiaRenderer,
  node: Element,
  parentStyle: SVGStyleContext
): void {
  const style = computeSVGStyleContext(node, parentStyle);
  const tagName = node.tagName.toLowerCase();

  switch (tagName) {
    case "svg":
    case "g":
      renderGroupNode(canvasKit, canvas, renderer, node, style);
      break;
    case "rect":
      renderRectNode(canvasKit, canvas, node, style);
      break;
    case "line":
      renderLineNode(canvasKit, canvas, node, style);
      break;
    case "polygon":
      renderPolygonNode(canvasKit, canvas, node, style, true);
      break;
    case "polyline":
      renderPolygonNode(canvasKit, canvas, node, style, false);
      break;
    case "circle":
      renderCircleNode(canvasKit, canvas, node, style);
      break;
    case "ellipse":
      renderEllipseNode(canvasKit, canvas, node, style);
      break;
    case "path":
      renderPathNode(canvasKit, canvas, node, style);
      break;
    case "text":
      renderTextNode(canvasKit, canvas, renderer, node, style);
      break;
    default:
      // Process children for unhandled grouping tags
      for (let i = 0; i < node.children.length; i++) {
        renderSVGNode(canvasKit, canvas, renderer, node.children[i], style);
      }
      break;
  }
}

function renderGroupNode(
  canvasKit: CanvasKit,
  canvas: any,
  renderer: SkiaRenderer,
  node: Element,
  style: SVGStyleContext
): void {
  canvas.save();

  // Apply transform attribute if present
  const transformAttr = node.getAttribute("transform");
  if (transformAttr) {
    applySVGTransform(canvas, transformAttr);
  }

  for (let i = 0; i < node.children.length; i++) {
    renderSVGNode(canvasKit, canvas, renderer, node.children[i], style);
  }

  canvas.restore();
}

function renderRectNode(
  canvasKit: CanvasKit,
  canvas: any,
  node: Element,
  style: SVGStyleContext
): void {
  const x = parseFloat(node.getAttribute("x") || "0");
  const y = parseFloat(node.getAttribute("y") || "0");
  const width = parseFloat(node.getAttribute("width") || "0");
  const height = parseFloat(node.getAttribute("height") || "0");
  const rx = parseFloat(node.getAttribute("rx") || "0");
  const ry = parseFloat(
    node.getAttribute("ry") || node.getAttribute("rx") || "0"
  );

  if (width <= 0 || height <= 0) return;

  const fillPaint = createSVGPaint(
    canvasKit,
    style.fill,
    style.fillOpacity,
    "fill"
  );
  const strokePaint = createSVGPaint(
    canvasKit,
    style.stroke,
    style.strokeOpacity,
    "stroke",
    style.strokeWidth
  );

  const rect = canvasKit.LTRBRect(x, y, x + width, y + height);

  try {
    if (rx > 0 || ry > 0) {
      const rrect = canvasKit.RRectXY(rect, rx, ry > 0 ? ry : rx);
      if (fillPaint) canvas.drawRRect(rrect, fillPaint);
      if (strokePaint) canvas.drawRRect(rrect, strokePaint);
    } else {
      if (fillPaint) canvas.drawRect(rect, fillPaint);
      if (strokePaint) canvas.drawRect(rect, strokePaint);
    }
  } finally {
    if (fillPaint) fillPaint.delete();
    if (strokePaint) strokePaint.delete();
  }
}

function renderLineNode(
  canvasKit: CanvasKit,
  canvas: any,
  node: Element,
  style: SVGStyleContext
): void {
  const x1 = parseFloat(node.getAttribute("x1") || "0");
  const y1 = parseFloat(node.getAttribute("y1") || "0");
  const x2 = parseFloat(node.getAttribute("x2") || "0");
  const y2 = parseFloat(node.getAttribute("y2") || "0");

  const strokePaint = createSVGPaint(
    canvasKit,
    style.stroke,
    style.strokeOpacity,
    "stroke",
    style.strokeWidth
  );
  if (!strokePaint) return;

  const path = new canvasKit.Path();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);

  try {
    canvas.drawPath(path, strokePaint);
  } finally {
    path.delete();
    strokePaint.delete();
  }
}

function renderPolygonNode(
  canvasKit: CanvasKit,
  canvas: any,
  node: Element,
  style: SVGStyleContext,
  close: boolean
): void {
  const pointsAttr = node.getAttribute("points");
  if (!pointsAttr) return;

  const coords = pointsAttr
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (coords.length < 4) return;

  const path = new canvasKit.Path();
  path.moveTo(coords[0], coords[1]);

  for (let i = 2; i < coords.length; i += 2) {
    if (!isNaN(coords[i]) && !isNaN(coords[i + 1])) {
      path.lineTo(coords[i], coords[i + 1]);
    }
  }

  if (close) {
    path.close();
  }

  const fillPaint = close
    ? createSVGPaint(canvasKit, style.fill, style.fillOpacity, "fill")
    : null;
  const strokePaint = createSVGPaint(
    canvasKit,
    style.stroke,
    style.strokeOpacity,
    "stroke",
    style.strokeWidth
  );

  try {
    if (fillPaint) canvas.drawPath(path, fillPaint);
    if (strokePaint) canvas.drawPath(path, strokePaint);
  } finally {
    path.delete();
    if (fillPaint) fillPaint.delete();
    if (strokePaint) strokePaint.delete();
  }
}

function renderCircleNode(
  canvasKit: CanvasKit,
  canvas: any,
  node: Element,
  style: SVGStyleContext
): void {
  const cx = parseFloat(node.getAttribute("cx") || "0");
  const cy = parseFloat(node.getAttribute("cy") || "0");
  const r = parseFloat(node.getAttribute("r") || "0");

  if (r <= 0) return;

  const fillPaint = createSVGPaint(
    canvasKit,
    style.fill,
    style.fillOpacity,
    "fill"
  );
  const strokePaint = createSVGPaint(
    canvasKit,
    style.stroke,
    style.strokeOpacity,
    "stroke",
    style.strokeWidth
  );

  try {
    if (fillPaint) canvas.drawCircle(cx, cy, r, fillPaint);
    if (strokePaint) canvas.drawCircle(cx, cy, r, strokePaint);
  } finally {
    if (fillPaint) fillPaint.delete();
    if (strokePaint) strokePaint.delete();
  }
}

function renderEllipseNode(
  canvasKit: CanvasKit,
  canvas: any,
  node: Element,
  style: SVGStyleContext
): void {
  const cx = parseFloat(node.getAttribute("cx") || "0");
  const cy = parseFloat(node.getAttribute("cy") || "0");
  const rx = parseFloat(node.getAttribute("rx") || "0");
  const ry = parseFloat(node.getAttribute("ry") || "0");

  if (rx <= 0 || ry <= 0) return;

  const rect = canvasKit.LTRBRect(cx - rx, cy - ry, cx + rx, cy + ry);
  const fillPaint = createSVGPaint(
    canvasKit,
    style.fill,
    style.fillOpacity,
    "fill"
  );
  const strokePaint = createSVGPaint(
    canvasKit,
    style.stroke,
    style.strokeOpacity,
    "stroke",
    style.strokeWidth
  );

  try {
    if (fillPaint) canvas.drawOval(rect, fillPaint);
    if (strokePaint) canvas.drawOval(rect, strokePaint);
  } finally {
    if (fillPaint) fillPaint.delete();
    if (strokePaint) strokePaint.delete();
  }
}

function renderPathNode(
  canvasKit: CanvasKit,
  canvas: any,
  node: Element,
  style: SVGStyleContext
): void {
  const d = node.getAttribute("d");
  if (!d) return;

  const path = canvasKit.Path.MakeFromSVGString(d);
  if (!path) return;

  const fillPaint = createSVGPaint(
    canvasKit,
    style.fill,
    style.fillOpacity,
    "fill"
  );
  const strokePaint = createSVGPaint(
    canvasKit,
    style.stroke,
    style.strokeOpacity,
    "stroke",
    style.strokeWidth
  );

  try {
    if (fillPaint) canvas.drawPath(path, fillPaint);
    if (strokePaint) canvas.drawPath(path, strokePaint);
  } finally {
    path.delete();
    if (fillPaint) fillPaint.delete();
    if (strokePaint) strokePaint.delete();
  }
}

function renderTextNode(
  canvasKit: CanvasKit,
  canvas: any,
  renderer: SkiaRenderer,
  node: Element,
  style: SVGStyleContext
): void {
  let x = parseFloat(node.getAttribute("x") || "0");
  let y = parseFloat(node.getAttribute("y") || "0");

  canvas.save();

  const transformAttr = node.getAttribute("transform");
  if (transformAttr) {
    applySVGTransform(canvas, transformAttr);
  }

  // Collect text segments (direct text child & <tspan> elements)
  const segments: Array<{
    text: string;
    style: SVGStyleContext;
    x?: number;
    y?: number;
  }> = [];

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3 /* Node.TEXT_NODE */) {
      const textVal = child.textContent || "";
      if (textVal) {
        segments.push({ text: textVal, style });
      }
    } else if (
      child.nodeType === 1 /* Node.ELEMENT_NODE */ &&
      (child as Element).tagName.toLowerCase() === "tspan"
    ) {
      const tspanEl = child as Element;
      const tspanStyle = computeSVGStyleContext(tspanEl, style);
      const tspanText = tspanEl.textContent || "";
      const tspanX = tspanEl.hasAttribute("x")
        ? parseFloat(tspanEl.getAttribute("x")!)
        : undefined;
      const tspanY = tspanEl.hasAttribute("y")
        ? parseFloat(tspanEl.getAttribute("y")!)
        : undefined;
      if (tspanText) {
        segments.push({
          text: tspanText,
          style: tspanStyle,
          x: tspanX,
          y: tspanY,
        });
      }
    }
  }

  if (segments.length === 0) {
    canvas.restore();
    return;
  }

  // Measure total width for text-anchor positioning
  let totalWidth = 0;
  const segmentWidths: number[] = [];

  for (const seg of segments) {
    const font = getSVGSkiaFont(canvasKit, renderer, seg.style);
    const glyphs = font.getGlyphIDs(seg.text);
    const widths = font.getGlyphWidths(glyphs);
    const width = widths.reduce((acc: number, w: number) => acc + w, 0);
    segmentWidths.push(width);
    totalWidth += width;
  }

  // Apply text-anchor horizontal offset
  if (style.textAnchor === "middle") {
    x -= totalWidth / 2;
  } else if (style.textAnchor === "end") {
    x -= totalWidth;
  }

  // Apply dominant-baseline vertical offset
  let baselineY = y;
  if (
    style.dominantBaseline === "central" ||
    style.dominantBaseline === "middle"
  ) {
    baselineY += style.fontSize * 0.35;
  } else if (style.dominantBaseline === "hanging") {
    baselineY += style.fontSize * 0.75;
  }

  let currentX = x;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const width = segmentWidths[i];
    const segX = seg.x !== undefined ? seg.x : currentX;
    const segY =
      seg.y !== undefined
        ? seg.y +
          (style.dominantBaseline === "central" ||
          style.dominantBaseline === "middle"
            ? seg.style.fontSize * 0.35
            : 0)
        : baselineY;

    const fillPaint = createSVGPaint(
      canvasKit,
      seg.style.fill,
      seg.style.fillOpacity,
      "fill"
    );
    const strokePaint = createSVGPaint(
      canvasKit,
      seg.style.stroke,
      seg.style.strokeOpacity,
      "stroke",
      seg.style.strokeWidth
    );
    const font = getSVGSkiaFont(canvasKit, renderer, seg.style);

    const useParagraphBuilder = renderer.renderOptions.useParagraphBuilder;

    try {
      if (fillPaint) {
        if (useParagraphBuilder) {
          renderSVGTextSegmentWithParagraphBuilder(
            canvasKit,
            canvas,
            renderer,
            seg.text,
            segX,
            segY,
            fillPaint,
            font,
            seg.style
          );
        } else {
          canvas.drawText(seg.text, segX, segY, fillPaint, font);
        }
      }
      if (strokePaint) {
        if (useParagraphBuilder) {
          renderSVGTextSegmentWithParagraphBuilder(
            canvasKit,
            canvas,
            renderer,
            seg.text,
            segX,
            segY,
            strokePaint,
            font,
            seg.style
          );
        } else {
          canvas.drawText(seg.text, segX, segY, strokePaint, font);
        }
      }
    } finally {
      if (fillPaint) fillPaint.delete();
      if (strokePaint) strokePaint.delete();
    }

    currentX = segX + width;
  }

  canvas.restore();
}

function renderSVGTextSegmentWithParagraphBuilder(
  canvasKit: CanvasKit,
  canvas: any,
  renderer: SkiaRenderer,
  str: string,
  xPos: number,
  yPos: number,
  paint: Paint,
  font: Font,
  style: SVGStyleContext
): void {
  const fontCollection = renderer.renderOptions
    .fontCollection as SkiaFontCollection;
  const fontMgr = fontCollection.fontMgr;
  const fontFamilies: string[] = [];

  if (style.fontFamily) {
    style.fontFamily.split(",").forEach((fam) => {
      const cleaned = fam.trim().replace(/^['"]|['"]$/g, "");
      if (cleaned && !fontFamilies.includes(cleaned)) {
        fontFamilies.push(cleaned);
      }
    });
  }

  fontCollection.getFamilies().forEach((fam) => {
    if (fam && !fontFamilies.includes(fam)) {
      fontFamilies.push(fam);
    }
  });

  const weight = mapCSSFontWeightToSkia(style.fontWeight);
  const slant = mapCSSFontStyleToSkia("normal");

  const paraStyle = new canvasKit.ParagraphStyle({
    textStyle: {
      color: paint ? (paint as any).getColor?.() : undefined,
      fontFamilies: fontFamilies.length > 0 ? fontFamilies : undefined,
      fontSize: style.fontSize,
      letterSpacing:
        style.letterSpacing &&
        style.letterSpacing !== 0 &&
        !isNaN(style.letterSpacing)
          ? style.letterSpacing
          : undefined,
      fontStyle: {
        weight: weight,
        slant: slant,
      },
    },
    strutStyle: {
      fontFamilies: fontFamilies.length > 0 ? fontFamilies : undefined,
      fontSize: style.fontSize,
      fontStyle: {
        weight: weight,
        slant: slant,
      },
      heightMultiplier: 1.0,
      leading: 0,
      forceStrutHeight: true,
      strutEnabled: true,
    },
  });

  const builder = canvasKit.ParagraphBuilder.MakeFromFontProvider(
    paraStyle,
    fontMgr
  );
  builder.addText(str);
  const paragraph = builder.build();
  builder.delete();

  paragraph.layout(1000000);

  let fontAscent = style.fontSize * 0.8;
  try {
    const metrics = (font as any).getMetrics?.();
    if (metrics && metrics.ascent) {
      fontAscent = Math.abs(metrics.ascent);
    }
  } catch {
    // fallback
  }

  canvas.drawParagraph(paragraph, xPos, yPos - fontAscent);
  paragraph.delete();
}

function computeSVGStyleContext(
  node: Element,
  parent: SVGStyleContext
): SVGStyleContext {
  const getAttr = (name: string): string | null => {
    return (
      node.getAttribute(name) ||
      (node as HTMLElement).style?.getPropertyValue(name) ||
      null
    );
  };

  const fill = getAttr("fill") ?? parent.fill;
  const fillOpacity = parseFloat(
    getAttr("fill-opacity") ?? `${parent.fillOpacity}`
  );
  const stroke = getAttr("stroke") ?? parent.stroke;
  const strokeWidth = parseFloat(
    getAttr("stroke-width") ?? `${parent.strokeWidth}`
  );
  const strokeOpacity = parseFloat(
    getAttr("stroke-opacity") ?? `${parent.strokeOpacity}`
  );
  const fontSize = parseFloat(getAttr("font-size") ?? `${parent.fontSize}`);
  const fontWeight = getAttr("font-weight") ?? parent.fontWeight;
  const fontFamily = getAttr("font-family") ?? parent.fontFamily;
  const letterSpacing = parseFloat(
    getAttr("letter-spacing") ?? `${parent.letterSpacing}`
  );
  const textAnchor = getAttr("text-anchor") ?? parent.textAnchor;
  const dominantBaseline =
    getAttr("dominant-baseline") ?? parent.dominantBaseline;

  return {
    fill,
    fillOpacity: isNaN(fillOpacity) ? parent.fillOpacity : fillOpacity,
    stroke,
    strokeWidth: isNaN(strokeWidth) ? parent.strokeWidth : strokeWidth,
    strokeOpacity: isNaN(strokeOpacity) ? parent.strokeOpacity : strokeOpacity,
    fontSize: isNaN(fontSize) ? parent.fontSize : fontSize,
    fontWeight,
    fontFamily,
    letterSpacing: isNaN(letterSpacing) ? parent.letterSpacing : letterSpacing,
    textAnchor,
    dominantBaseline,
  };
}

function createSVGPaint(
  canvasKit: CanvasKit,
  colorStr: string,
  opacity: number,
  style: "fill" | "stroke",
  strokeWidth: number = 1.0
): Paint | null {
  if (
    !colorStr ||
    colorStr === "none" ||
    colorStr === "transparent" ||
    opacity <= 0
  ) {
    return null;
  }

  let color4f: Float32Array | null = null;
  try {
    color4f = canvasKit.parseColorString(colorStr);
  } catch {
    color4f = null;
  }

  if (!color4f) {
    return null;
  }

  const paint = new canvasKit.Paint();
  if (style === "fill") {
    paint.setStyle(canvasKit.PaintStyle.Fill);
  } else {
    paint.setStyle(canvasKit.PaintStyle.Stroke);
    paint.setStrokeWidth(strokeWidth);
  }

  if (opacity < 1.0) {
    color4f[3] = color4f[3] * opacity;
  }

  paint.setColor(color4f);
  paint.setAntiAlias(true);
  return paint;
}

function applySVGTransform(canvas: any, transformAttr: string): void {
  const transforms = transformAttr.match(/(\w+)\s*\(([^)]+)\)/g);
  if (!transforms) return;

  for (const t of transforms) {
    const match = /(\w+)\s*\(([^)]+)\)/.exec(t);
    if (!match) continue;
    const type = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    switch (type) {
      case "translate":
        if (args.length >= 1) canvas.translate(args[0], args[1] || 0);
        break;
      case "scale":
        if (args.length >= 1)
          canvas.scale(args[0], args[1] !== undefined ? args[1] : args[0]);
        break;
      case "rotate":
        if (args.length >= 1) {
          if (args.length >= 3) {
            canvas.translate(args[1], args[2]);
            canvas.rotate(args[0], 0, 0);
            canvas.translate(-args[1], -args[2]);
          } else {
            canvas.rotate(args[0], 0, 0);
          }
        }
        break;
    }
  }
}

function getSVGSkiaFont(
  canvasKit: CanvasKit,
  renderer: SkiaRenderer,
  style: SVGStyleContext
): Font {
  const fontCollection = renderer.renderOptions
    .fontCollection as SkiaFontCollection;
  if (fontCollection && fontCollection.fontMgr) {
    let weightNum = 400;
    if (style.fontWeight === "bold") weightNum = 700;
    else if (!isNaN(parseFloat(style.fontWeight)))
      weightNum = parseFloat(style.fontWeight);

    const families = [
      style.fontFamily,
      "Plus Jakarta Sans",
      "Roboto",
      "sans-serif",
    ];
    for (const fam of families) {
      try {
        const typeface = fontCollection.fontMgr.matchFamilyStyle(fam, {
          weight: weightNum,
          width: 0,
          slant: 0,
        } as any);
        if (typeface) {
          return fontCollection.getFont(typeface, style.fontSize);
        }
      } catch {
        continue;
      }
    }
    if (fontCollection.emptyFont) {
      const font = new canvasKit.Font();
      font.setSize(style.fontSize);
      return font;
    }
  }

  const font = new canvasKit.Font();
  font.setSize(style.fontSize);
  return font;
}
