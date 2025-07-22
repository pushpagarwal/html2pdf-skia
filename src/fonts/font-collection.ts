import { CanvasKit, Font, Typeface, TypefaceFontProvider } from "@rollerbird/canvaskit-wasm-pdf";
import { FontFamilyClass, FontStylePojo, IFontCollection, IFontProperties, IFontStyle, UnicodeCharacterBucket } from "./interfaces";
import { enumerateFonts, enumerateMissingGlyphs, getUnicodeCharacterBucket } from "./font-enumeration";
import { toSkiaFontStyle } from "./font-style-mapping";


interface IFontInfo {
    family: string;
    style: IFontStyle;
    url?: string;
    descriptors?: FontFaceDescriptors;
    buffer: ArrayBuffer; // Optional buffer for font data
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SkiaFontCollection implements IFontCollection {
    fontMgr: TypefaceFontProvider;
    private defaultFonts: Map<FontFamilyClass, string[]> = new Map();
    private fallbackFonts: Map<UnicodeCharacterBucket, string[]> = new Map();
    private families: Set<string> = new Set();
    private fonts: IFontInfo[] = []; // Store font info for added fonts
    private fontsCache: Map<string, Font> = new Map();
    readonly emptyFont: Font;// Default empty font
    constructor(public canvasKit: CanvasKit) {
        this.fontMgr = this.canvasKit.TypefaceFontProvider.Make();
        this.emptyFont = new this.canvasKit.Font(); // Create an empty font instance
    }

    addFont(buffer: ArrayBuffer, family: string, fontStyle?: IFontStyle,
            url?: string, descriptors?: FontFaceDescriptors): void {
        this.fontMgr.registerFont(buffer, family);
        this.families.add(family);
        this.fonts.push({ family, style: fontStyle || {}, url, descriptors, buffer });
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

    getFallbackFontTypeface(text: string, fontStyle: FontStylePojo): Typeface | null {
        const key = getUnicodeCharacterBucket(text);
        const fallbackFontFamilies = this.fallbackFonts.get(key) || [];
        for (const familyName of fallbackFontFamilies) {
            const typeface = this.fontMgr.matchFamilyStyle(familyName, fontStyle as any);
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
    async addFontsToDocument(cloneDocument: Document): Promise<void> {
        await Promise.all(this.fonts.map(async (font) => {
            const fontFace: FontFace = new FontFace(
                        font.family,
                        font.buffer,
                        font.descriptors
                    );
            const loadedFace: FontFace = await fontFace.load();
            cloneDocument.fonts.add(loadedFace);
        }));
        await cloneDocument.fonts.ready; // Ensure all fonts are loaded before proceeding
        await delay(0); // Yield to allow font loading to complete
    }
    getFont(typeface: Typeface, fontSize: number): Font {
        const cacheKey = `${(typeface as any).cb.lb}-${fontSize}`;
        if (this.fontsCache.has(cacheKey)) {
            return this.fontsCache.get(cacheKey)!;
        }
        const font = new this.canvasKit.Font();
        font.setTypeface(typeface);
        font.setSize(fontSize);
        font.setLinearMetrics(true); // Enable linear metrics for better text rendering
        this.fontsCache.set(cacheKey, font);
        return font;
    }
    clearResources(): void {
        this.fontsCache.forEach((font) => {
            font.delete();
        });
        this.fontsCache.clear();
        this.fonts = []; // Clear the font info array
        this.defaultFonts.clear(); // Clear default fonts map
        this.fallbackFonts.clear(); // Clear fallback fonts map
        this.families.clear(); // Clear families set
        this.fontMgr.delete(); // Delete the font manager instance
        this.fontMgr.delete(); // Clean up the font provider
        this.emptyFont.delete(); // Clear the empty font instance
    }
}

export function createFontCollection(canvasKit: CanvasKit): IFontCollection {
    return new SkiaFontCollection(canvasKit);
}
