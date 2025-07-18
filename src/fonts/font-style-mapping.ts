import { IFontProperties, FontSlant, FontStylePojo } from "./interfaces";

export function toSkiaFontSlant(slant: FontSlant): number {
    switch (slant) {
        case 'italic':
            return 1;
        case 'oblique':
            return 2;
        default:
            return 0;
    }
}

export function toSkiaFontStyle(fontStyle: IFontProperties): [string[], FontStylePojo] {
    const families = fontStyle.families || [];
    const skiaFontSlant = toSkiaFontSlant(fontStyle.fontSlant || 'normal');

    const skiaFontStyle = {
        weight: fontStyle.fontWeight ?? 400,
        slant: skiaFontSlant,
        width: 400, // Default to normal width
    }
    return [families, skiaFontStyle];
}