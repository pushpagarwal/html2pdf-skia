import { clearHideNextPageItems, HIDE_NEXT_PAGE_ITEM_CLASS, HIDE_PREVIOUS_PAGE_ITEM_CLASS } from "./dom-updates";

export class HtmlPageBreak {
    private document: Document;
    private pageHeight: number = 0;
    private pageItems: HTMLElement[] = [];

    constructor(document: Document, pageHeight: number) {
        this.document = document;
        this.pageHeight = pageHeight;
    }

    public processPage(): HTMLElement | null {
        let finalPageHeight = this.pageHeight;
        this.pageItems = []; // Reset page items

        const getUnionOfBounds = (bounds1?: DOMRect, bounds2?: DOMRect): DOMRect | undefined => {
            if (!bounds1) {
                return bounds2; // If no bounds1, return bounds2
            }
            if (!bounds2) {
                return bounds1; // If no bounds2, return bounds1
            }
            // Calculate the union of two DOMRect objects
            const top = Math.min(bounds1.top, bounds2.top);
            const bottom = Math.max(bounds1.top + bounds1.height, bounds2.top + bounds2.height);
            const left = Math.min(bounds1.left, bounds2.left);
            const right = Math.max(bounds1.left + bounds1.width, bounds2.left + bounds2.width);
            return new DOMRect(left, top, right - left, bottom - top);
        };

        const NO_PAGE_ITEMS: HTMLElement[] = [];
        const calculateNewBounds = (element: HTMLElement, bounds?: DOMRect): DOMRect | undefined => {
            if (element.classList.contains(HIDE_NEXT_PAGE_ITEM_CLASS)) {
                return bounds; // Skip elements already marked for hiding
            }
            if (element.children.length === 0) {
                // If no children, check if element is completely within the page height
                const elementBounds = element.getBoundingClientRect();
                bounds = getUnionOfBounds(bounds, elementBounds);
                return bounds;
            }
            // If element has children, traverse them
            for (const child of Array.from(element.children) as HTMLElement[]) {
                const childBounds = calculateNewBounds(child, bounds);
                bounds = getUnionOfBounds(bounds, childBounds);
            }
            return bounds;
        };

        const processElement = (element: HTMLElement): HTMLElement[] => {
            // Skip elements with hide-previous-page-item class
            if (element.classList.contains(HIDE_PREVIOUS_PAGE_ITEM_CLASS)) {
                return NO_PAGE_ITEMS;
            }

            const bounds = element.getBoundingClientRect();
            const elementTop = bounds.top;
            const elementBottom = bounds.bottom;

            // If element starts beyond page height, hide it
            if (elementTop >= finalPageHeight) {
                element.classList.add(HIDE_NEXT_PAGE_ITEM_CLASS);
                return NO_PAGE_ITEMS; // Stop processing this element
            }

            // If element is completely inside page, don't traverse children
            if (elementTop >= 0 && elementBottom <= finalPageHeight) {
                // Element is completely inside page, no need to process children
                if (this.shouldRepeatOnEveryPage(element)) {
                    return NO_PAGE_ITEMS; // Don't add to page items, but mark for repeat
                }
                return [element]; // Element is completely inside page, return it
            }

            // If element overlaps with page but not completely inside
            if (elementTop < finalPageHeight && elementBottom > finalPageHeight) {
                const overlap = finalPageHeight - elementTop;
                const elementHeight = bounds.height;
                if (this.shouldTreatAsSingleElement(element)
                    || (this.shouldCheckForOverlap(element)
                        && overlap < (elementHeight * 0.2)
                        && overlap < (this.pageHeight * 0.4))) { // Less than 20% overlap
                    element.classList.add(HIDE_NEXT_PAGE_ITEM_CLASS);
                    // Reduce page height to top of element
                    finalPageHeight = Math.min(finalPageHeight, elementTop);
                    return NO_PAGE_ITEMS // Stop iteration
                } else {
                    // Traverse children
                    const pageItems: HTMLElement[] = [];
                    for (const child of Array.from(element.children) as HTMLElement[]) {
                        pageItems.push(...processElement(child));
                    }
                    // After processing children, check if the element does have sufficient overlap
                    // with respect to the original element height
                    if (this.shouldCheckForOverlap(element)) {
                        const newBounds = calculateNewBounds(element);
                        if (newBounds) {
                            if (newBounds.height < (elementHeight * 0.2) && newBounds.height < (this.pageHeight * 0.4)) {
                                element.classList.add(HIDE_NEXT_PAGE_ITEM_CLASS); // Hide next page item
                                finalPageHeight = Math.min(finalPageHeight, newBounds.top); // Reduce page height
                                return NO_PAGE_ITEMS; // Stop iteration
                            }
                        }
                    }
                    // If we reach here, it means the element has significant overlap
                    return pageItems;
                }
            }
            return [element]; // Element is not hidden, process it
        }

        // Start processing from document element
        for (const child of Array.from(this.document.body.children) as HTMLElement[]) {
            this.pageItems.push(...processElement(child));
        }

        if (this.pageItems.length === 0) {
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
        if (/h[1-9]/.test(tagName)) {
            return true; // Treat headings as single elements
        }
        return tagName === 'img' || tagName === 'svg' || tagName === 'canvas' || tagName === 'video' ||
            tagName === 'audio' || tagName === 'picture' ||
            element.classList.contains('no-break');
    }

    protected shouldCheckForOverlap(element: HTMLElement): boolean {
        const tagName = element.tagName.toLowerCase();
        // Check if the element is a block-level element or has a specific tag that requires overlap checking
        if (tagName === 'p' || tagName === 'section' || tagName === 'table') {
            return true;
        }
        // Override this method to implement custom logic
        const computedStyle = window.getComputedStyle(element);
        return computedStyle.display !== 'inline' && computedStyle.display !== 'inline-block' &&
            computedStyle.display !== 'inline-flex' && computedStyle.display !== 'flex';
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
