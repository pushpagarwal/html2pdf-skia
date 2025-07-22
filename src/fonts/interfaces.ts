export type FontWidth = 'normal' | 'narrow' | 'wide';
export type FontSlant = 'normal' | 'italic' | 'oblique';

export type FontFamilyClass = 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy' | 'fangsong';
export type UnicodeCharacterBucket = 'cjk' | 'emoji' | 'symbol' | 'unicode';

export interface IFontStyle {
    fontWeight?: number;
    fontWidth?: FontWidth;
    fontSlant?: FontSlant;
}

export type IFontProperties = IFontStyle & {
    families: string[];
}

export type FontFamilyKey = FontFamilyClass | UnicodeCharacterBucket;


export interface IFontCollection {
   addFont(buffer: ArrayBuffer, family: string, fontStyle?: IFontStyle,
    url?: string, descriptors?: FontFaceDescriptors): void;
   setDefaultFonts(fontFamilyClass: FontFamilyClass, families: string[]): void;
   setFallbackFonts(unicodeCharacterBucket: UnicodeCharacterBucket, families: string[]): void;
   
   getMissingFonts(element: HTMLElement): IFontProperties[];
   getMissingGlyphsCategories(element: HTMLElement, fontStyle: IFontStyle): string[];
   clearResources(): void;
}

export interface FontStylePojo {
    weight?: number;
    width?: number;
    slant?: number;
}