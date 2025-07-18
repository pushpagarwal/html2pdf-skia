import { CanvasKit, Typeface, TypefaceFontProvider } from "@rollerbird/canvaskit-wasm-pdf";
import { FontFamilyClass, IFontCollection, IFontProperties, IFontStyle, UnicodeCharacterBucket } from "./interfaces";
import { enumerateFonts, enumerateMissingGlyphs, getUnicodeCharacterBucket } from "./font-enumeration";
import { toSkiaFontStyle } from "./font-style-mapping";

export class SkiaFontCollection implements IFontCollection {
    fontMgr: TypefaceFontProvider;
    private defaultFonts: Map<FontFamilyClass, string[]> = new Map();
    private fallbackFonts: Map<UnicodeCharacterBucket, string[]> = new Map();
    private families: Set<string> = new Set();

    constructor(private canvasKit: CanvasKit) {
        this.fontMgr = this.canvasKit.TypefaceFontProvider.Make();
    }

    addFont(buffer: ArrayBuffer, family: string, _fontStyle?: IFontStyle): void {
        this.fontMgr.registerFont(buffer, family);
        this.families.add(family);
    }

    setDefaultFonts(fontFamilyClass: FontFamilyClass, families: string[]): void {
        families = families.filter(family => this.families.has(family));
        if (families.length === 0) {
            throw new Error(`No valid families provided for ${fontFamilyClass}`);
        }
        this.defaultFonts.set(fontFamilyClass, families);
    }

    setFallbackFonts(unicodeCharacterBucket: UnicodeCharacterBucket, families: string[]): void {
        families = families.filter(family => this.families.has(family));
        if (families.length === 0) {
            throw new Error(`No valid families provided for ${unicodeCharacterBucket}`);
        }
        this.fallbackFonts.set(unicodeCharacterBucket, families);
    }

    getMissingFonts(element: HTMLElement): IFontProperties[] {
        // Implementation to find missing fonts based on the element's styles
        const requiredFonts: IFontProperties[] = enumerateFonts([element]);
        return requiredFonts.filter(font => {
             // If most preferred style is not found, treat it as missing
            if(!this.families.has(font.families[0]))
                return true; // Font is missing
            const [_, style] = toSkiaFontStyle(font);
            const typeface = this.fontMgr.matchFamilyStyle(font.families[0], style as any);
            return !typeface; // Typeface not found in the font manager
        });
    }

    getMissingGlyphsCategories(element: HTMLElement): UnicodeCharacterBucket[] {
        // Implementation to find missing glyph categories
        return enumerateMissingGlyphs(this.fontMgr, [element]);
    }

    getFallbackFontTypeface(text: string, fontStyle: IFontStyle): Typeface | null {
        const key = getUnicodeCharacterBucket(text);
        const fallbackFontFamilies = this.fallbackFonts.get(key) || [];
        const [_, style] = toSkiaFontStyle({...fontStyle, families:[]});
        for (const familyName of fallbackFontFamilies) {
            const typeface = this.fontMgr.matchFamilyStyle(familyName, style as any);
            if (typeface && typeface.getGlyphIDs(text).filter(id => id !== 0).length > 0) {
                return typeface;
            }
        }
        return null;    
    }
    getFallbackFontFamilies(familyClasses: FontFamilyClass[]): string[] {
        const fallbackFamilies: string[] = [];
        for (const familyClass of familyClasses) {
            const families = this.defaultFonts.get(familyClass);
            if (families) {
                fallbackFamilies.push(...families);
            }
        }
        return fallbackFamilies;
    }
}

export function createFontCollection(canvasKit: CanvasKit): IFontCollection {
    return new SkiaFontCollection(canvasKit);
}
