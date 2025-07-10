export const HIDE_PREVIOUS_PAGE_ITEM_CLASS = 'hide-previous-page-item';
export const HIDE_NEXT_PAGE_ITEM_CLASS = 'hide-next-page-item';

export function appendPageStyles(document: Document): void {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .${HIDE_PREVIOUS_PAGE_ITEM_CLASS} {
            display: none !important;
        }
        
        .${HIDE_NEXT_PAGE_ITEM_CLASS} {
            display: none !important;
        }
    `;
    
    document.head.appendChild(styleElement);
}
export function clearPageStyles(document: Document): void {
    const styleElements = document.querySelectorAll('style');
    styleElements.forEach(style => {
        if (style.textContent?.includes(`.${HIDE_PREVIOUS_PAGE_ITEM_CLASS}`)) {
            style.remove();
        }
    });
}
export function clearHidePreviousPageItems(document: Document): void {
    const elements = document.querySelectorAll(`.${HIDE_PREVIOUS_PAGE_ITEM_CLASS}`);
    elements.forEach(element => {
        element.classList.remove(HIDE_PREVIOUS_PAGE_ITEM_CLASS);
    });
}
export function clearHideNextPageItems(document: Document): void {
    const elements = document.querySelectorAll(`.${HIDE_NEXT_PAGE_ITEM_CLASS}`);
    elements.forEach(element => {
        element.classList.remove(HIDE_NEXT_PAGE_ITEM_CLASS);
    });
}