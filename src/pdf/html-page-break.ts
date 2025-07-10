import { clearHideNextPageItems, HIDE_NEXT_PAGE_ITEM_CLASS, HIDE_PREVIOUS_PAGE_ITEM_CLASS } from "./dom-updates";

export class HtmlPageBreak {
    private document: Document;
    private pageHeight: number = 0;
    private pageItems: HTMLElement[] = [];

    constructor(document: Document, pageHeight: number) {
        this.document = document;
        this.pageHeight = pageHeight;
    }

    public processPage(): HTMLElement| null {
        let finalPageHeight = this.pageHeight;
        this.pageItems = []; // Reset page items

        const processElement = (element: HTMLElement): void => {
            // Skip elements with hide-previous-page-item class
            if (element.classList.contains(HIDE_PREVIOUS_PAGE_ITEM_CLASS)) {
                return;
            }

            const bounds = element.getBoundingClientRect();
            const elementTop = bounds.top;
            const elementBottom = bounds.bottom;

            // If element starts beyond page height, hide it
            if (elementTop >= finalPageHeight) {
                element.classList.add(HIDE_NEXT_PAGE_ITEM_CLASS);
                return;
            }

            // If element is completely inside page, don't traverse children
            if (elementTop >= 0 && elementBottom <= finalPageHeight) {
                if (!this.shouldRepeatOnEveryPage(element)) {
                    this.pageItems.push(element); // Record page item
                }
                return;
            }

            // If element overlaps with page but not completely inside
            if (elementTop < finalPageHeight && elementBottom > finalPageHeight) {
                if (this.shouldTreatAsSingleElement(element)) {
                    element.classList.add(HIDE_NEXT_PAGE_ITEM_CLASS);
                    // Reduce page height to top of element
                    finalPageHeight = Math.min(finalPageHeight, elementTop);
                    return; // Stop iteration
                } else {
                    // Traverse children
                    for (const child of Array.from(element.children) as HTMLElement[]) {
                        processElement(child);
                    }
                }
            }
        };

        // Start processing from document element
        for (const child of Array.from(this.document.body.children) as HTMLElement[]) {
            processElement(child);
        }

        if(this.pageItems.length === 0) {
            return null; // No items to process
        }
        return this.document.body; // Return body as the processed page
    }

    protected shouldTreatAsSingleElement(element: HTMLElement): boolean {
        // Override this method to implement custom logic
        
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'flex' || computedStyle.display === 'inline-flex') {
            return true;
        }
        const tagName = element.tagName.toLowerCase();
        return tagName === 'img' || tagName === 'svg' || tagName === 'canvas' || tagName === 'video' ||
            tagName === 'audio' || tagName === 'picture' ||                                
            element.classList.contains('no-break');
    }

    protected shouldRepeatOnEveryPage(element: HTMLElement): boolean {
        const tagName = element.tagName.toLowerCase();
        return tagName === 'thead' || tagName === 'tfoot' ||
            tagName === 'header' || tagName === 'footer';
    }
    public postProcess(): void {
        // Add hide class to recorded page items
        for (const element of this.pageItems) {
            element.classList.add(HIDE_PREVIOUS_PAGE_ITEM_CLASS);
        }
        // Remove hide-next-page-item class from all elements
        clearHideNextPageItems(this.document);
    }
}
