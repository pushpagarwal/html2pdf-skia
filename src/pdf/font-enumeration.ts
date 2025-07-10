
const fontNamesToFilter = new Set([ 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy' ]);
export function enumerateFonts(elements: HTMLElement[]): Set<string> {
    const fonts = new Set<string>();
    const collectFonts = (el: Element): void => {
        const computedStyle = window.getComputedStyle(el);
        const fontFamily = computedStyle.fontFamily;
        
        if (fontFamily) {
            // Parse font-family string and extract individual font names
            const fontList = fontFamily
                .split(',')
                .map(font => font.toLowerCase().trim().replace(/['"]/g, ''))
                .filter(font => font.length > 0)
                .filter(font => !fontNamesToFilter.has(font));
            
            fontList.forEach(font => fonts.add(font));
        }
        
        // Recursively check all child elements
        for (const child of Array.from(el.children)) {
            collectFonts(child);
        }
    }

    elements.forEach( element => collectFonts(element));
    return fonts;
}