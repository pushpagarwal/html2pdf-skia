
import {
    CanvasKit,
    FontStyle,
    FontMgr,
    Typeface
} from 'canvaskit-wasm';

import emojiRegex from 'emoji-regex-xs';

export interface IFallbackFont {
    family: string;
    fontBuffers: ArrayBuffer[];
}

export interface IFallbackFontConfig {
    cjk?: IFallbackFont[];
    emoji?: IFallbackFont[];
    symbol?: IFallbackFont[];
    unicode?: IFallbackFont[];
    language?: Record<string, IFallbackFont[]>;
}

class SkiaFallbackFontCollection {
    private _cache: Map<string, FontMgr> = new Map();
    constructor(private canvasKit: CanvasKit, private fallbackFontConfig: IFallbackFontConfig) {}
    getFontManager(key: 'cjk'|'emoji'|'symbol'|'unicode'): FontMgr | null {
        const fontMgr = this._cache.get(key);
        if (!fontMgr) {
            const fallbackFonts = this.fallbackFontConfig[key] ?? [];
            const fontBuffers = fallbackFonts.reduce<ArrayBuffer[]>((acc, font) => {
                acc.push(...font.fontBuffers);
                return acc;
            }, []);
            const newFontMgr = this.canvasKit.FontMgr.FromData(...fontBuffers);
            if(newFontMgr) {
                this._cache.set(key, newFontMgr);
            }
            return newFontMgr;
        }
        return fontMgr;
    }
    getFallbackFontTypeface(key: 'cjk'|'emoji'|'symbol'|'unicode', text: string, fontStyle: FontStyle): Typeface | null {
        const fontMgr = this.getFontManager(key);
        if (!fontMgr) {
            return null;
        }
        const fallbackFonts = this.fallbackFontConfig[key] ?? [];
        const familyNames = fallbackFonts.map(font => font.family);
        for( const familyName of familyNames) {
            const typeface = fontMgr.matchFamilyStyle(familyName, fontStyle);
            if (typeface) {
                const glyphIDs = typeface.getGlyphIDs(text);
                if (glyphIDs.length > 0 && glyphIDs[0] !== 0) {
                    return typeface;
                }
            }
        }
       return null;
    }
}

export class FallbackFontProvider {
    private fontCollection: SkiaFallbackFontCollection;

    constructor(canvasKit: CanvasKit, fallbackFonts: IFallbackFontConfig) {
        this.fontCollection = new SkiaFallbackFontCollection(canvasKit, fallbackFonts);
    }

    getFallbackFontTypeface(text: string): Typeface | null {
        const fontStyle = {};
        if (text.match(/[\u4e00-\u9faf]/)) {
            return this.fontCollection.getFallbackFontTypeface('cjk', text, fontStyle);
        }
        if (emojiRegex().test(text)) {
            return this.fontCollection.getFallbackFontTypeface('emoji', text, fontStyle);
        }
        if (text.match(/[\u20A0-\u20CF\u2190-\u21FF\u2300-\u23FF\u2500-\u27BF]/)) {
            return this.fontCollection.getFallbackFontTypeface('symbol', text, fontStyle);
        }
        return this.fontCollection.getFallbackFontTypeface('unicode', text, fontStyle);
    }
    
}


