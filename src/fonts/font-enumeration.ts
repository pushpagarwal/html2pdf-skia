import { FontMgr } from "@rollerbird/canvaskit-wasm-pdf";
import { Context } from "../core/context";
import { Bounds } from "../css/layout/bounds";
import { fontFamily } from "../css/property-descriptors/font-family";
import { fontStyle } from "../css/property-descriptors/font-style";
import { fontWeight } from "../css/property-descriptors/font-weight";
import { isIdentToken, Parser } from "../css/syntax/parser";
import { Tokenizer } from "../css/syntax/tokenizer";
import { IFontProperties, FontSlant, UnicodeCharacterBucket } from "./interfaces";
import { toSkiaFontStyle } from "./font-style-mapping";
import { segmentGraphemes } from "../css/layout/text";
import emojiRegex from "emoji-regex-xs";



const fontNamesToFilter = new Set([ 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy' ]);
export function enumerateFonts(elements: HTMLElement[]): IFontProperties[]{
    const fonts = new Set<IFontProperties>();
    const ctx = new Context({logging:true, imageTimeout:5000, useCORS:true, allowTaint:true}, Bounds.EMPTY);
    const collectFonts = (el: Element): void => {
        const computedStyle = window.getComputedStyle(el);
        let fontProperty: IFontProperties = {
            families: parseFontFamily(ctx, computedStyle.fontFamily) ?? [],
            fontWeight: parseFontWeight(ctx, computedStyle.fontWeight),
            fontSlant: parseFontSlant(ctx, computedStyle.fontStyle),
        }

        fonts.add(fontProperty);

        // Recursively check all child elements
        for (const child of Array.from(el.children)) {
            collectFonts(child);
        }
    }

    elements.forEach( element => collectFonts(element));
    return Array.from(fonts);
}



function parseFontFamily(
  context: Context,
  value: string
): string[] {
  const tokens = new Tokenizer();
  tokens.write(value);
  const parser = new Parser(tokens.read());
  const families = fontFamily.parse(context, parser.parseComponentValues());
  return families.filter(family => {
    return !fontNamesToFilter.has(family.toLowerCase());
  });
}

function parseFontWeight(
  context: Context,
  value: string
): number {
  const tokens = new Tokenizer();
  tokens.write(value);
  const parser = new Parser(tokens.read());
  return fontWeight.parse(context, parser.parseComponentValue());
}   

function parseFontSlant(
  context: Context,
  value: string
): FontSlant {
  const tokens = new Tokenizer();
  tokens.write(value);
  const parser = new Parser(tokens.read());
  const token = parser.parseComponentValue();
  return fontStyle.parse(context, isIdentToken(token) ? token.value : fontStyle.initialValue);
}


export function enumerateMissingGlyphs(fontMgr: FontMgr, elements: HTMLElement[]): UnicodeCharacterBucket[]{
    const buckets: Record<UnicodeCharacterBucket, boolean> = {
        symbol: false,
        cjk: false,
        emoji: false,
        unicode: false
    };
    const ctx = new Context({logging:true, imageTimeout:5000, useCORS:true, allowTaint:true}, Bounds.EMPTY);
    const collectMissingGlyphs = (el: Element): void => {
        const computedStyle = window.getComputedStyle(el);
        let fontProperty: IFontProperties = {
            families: parseFontFamily(ctx, computedStyle.fontFamily) ?? [],
            fontWeight: parseFontWeight(ctx, computedStyle.fontWeight),
            fontSlant: parseFontSlant(ctx, computedStyle.fontStyle),
        }
        const [families, style] = toSkiaFontStyle(fontProperty);
        for(const family of families) {
            const typeface = fontMgr.matchFamilyStyle(family, style as any);
            if (!typeface) {
                continue;
            }
            // First check if the font has glyphs for the required characters
            const missingGlyphs = typeface.getGlyphIDs(el.textContent || "").some(glyphID => glyphID === 0);
            // Now iterate using Int grepheme to find missing glyphs
            if (missingGlyphs) {
                segmentGraphemes(el.textContent || "").forEach(grapheme => {
                    const glyphIds = typeface.getGlyphIDs(grapheme);
                    if (glyphIds[0] === 0) {
                        // If glyphID is 0, it means the glyph is missing
                        const bucket = getUnicodeCharacterBucket(grapheme);
                        buckets[bucket] = true;
                    }
                });
            }
        }
        // Recursively check all child elements
        for (const child of Array.from(el.children)) {
            collectMissingGlyphs(child);
        }
    }

    elements.forEach( element => collectMissingGlyphs(element));
    return Object.keys(buckets).filter(key => buckets[key as UnicodeCharacterBucket]) as UnicodeCharacterBucket[];
}

export function getUnicodeCharacterBucket(text: string): UnicodeCharacterBucket {
    if (/[\u4e00-\u9faf]/.test(text)) {
        return 'cjk';
    }
    if (emojiRegex().test(text)) {
        return 'emoji';
    }
    if (/[\u2600-\u26FF\u2700-\u27BF]/.test(text)) {
        return 'symbol';
    }
    return 'unicode';
}