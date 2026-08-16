import { SMALL_IMAGE } from "../core/util";
export interface FontMetric {
  baseline: number;
  middle: number;
}

const SAMPLE_TEXT = "Hidden Text";

export class FontMetrics {
  private readonly _data: { [key: string]: FontMetric };
  private readonly _document: Document;

  constructor(document: Document) {
    this._data = {};
    this._document = document;
  }

  /**
   * Compute font metrics directly from CanvasKit SkiaFont
   */
  static getMetricsFromSkFont(font: any): FontMetric {
    if (font && typeof font.getMetrics === "function") {
      try {
        const skMetrics = font.getMetrics();
        const baseline = Math.abs(skMetrics.ascent);
        const middle = baseline - font.getSize() / 2;
        return { baseline, middle };
      } catch {
        /* Fallback */
      }
    }
    const size = font?.getSize?.() ?? 16;
    return { baseline: size * 0.8, middle: size * 0.4 };
  }

  private parseMetrics(fontFamily: string, fontSize: string): FontMetric {
    const container = this._document.createElement("div");
    const img = this._document.createElement("img");
    const span = this._document.createElement("span");

    const body = this._document.body as HTMLBodyElement;

    container.style.all = "initial";
    container.style.visibility = "hidden";
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.fontFamily = fontFamily;
    container.style.fontSize = fontSize;
    container.style.lineHeight = "normal";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.border = "0";
    container.style.boxSizing = "content-box";
    container.style.whiteSpace = "nowrap";

    body.appendChild(container);

    img.src = SMALL_IMAGE;
    img.width = 1;
    img.height = 1;
    img.style.all = "initial";
    img.style.margin = "0";
    img.style.padding = "0";
    img.style.border = "0";
    img.style.verticalAlign = "baseline";

    span.style.all = "initial";
    span.style.fontFamily = fontFamily;
    span.style.fontSize = fontSize;
    span.style.lineHeight = "normal";
    span.style.margin = "0";
    span.style.padding = "0";
    span.style.border = "0";
    span.style.boxSizing = "content-box";

    span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
    container.appendChild(span);
    container.appendChild(img);
    const baseline = img.offsetTop - span.offsetTop + 2;

    container.removeChild(span);
    container.appendChild(this._document.createTextNode(SAMPLE_TEXT));

    img.style.verticalAlign = "super";

    const middle = img.offsetTop - container.offsetTop + 2;

    body.removeChild(container);

    return { baseline, middle };
  }

  getMetrics(fontFamily: string, fontSize: string): FontMetric {
    const key = `${fontFamily} ${fontSize}`;
    if (typeof this._data[key] === "undefined") {
      this._data[key] = this.parseMetrics(fontFamily, fontSize);
    }

    return this._data[key];
  }
}
