import { CanvasKit, FontMgr, PDFMetadata, PDFTag } from "canvaskit-wasm";
import { parseTree } from "../dom/node-parser";
import { Context } from "../core/context";
import { SkiaRenderer } from "../render/skia/skia-renderer";

export interface IPageSize {
    width: number;
    height: number;
}
export interface IPdfInputProvider {
    getDocumentStructure(): PDFTag;
    getFontManager(): Promise<FontMgr>;
    getNextPageElement(): Promise<HTMLElement | null>;
}

export type FontLoader = (fontList: string[]) => Promise<ArrayBuffer[]>;

export interface IPdfOptions {
    title: string;
    author: string;
    subject: string;
    keywords: string;
    creator: string;
    producer: string;
    pageSize: { width: number; height: number };
    fontLoader: FontLoader;
}

export async function exportToPdf(
    canvasKit: CanvasKit,
    context: Context,
    inputProvider: IPdfInputProvider,
    pdfOptions?: Partial<IPdfOptions>): Promise<Blob> {
    const rootTag = inputProvider.getDocumentStructure();
    const metadata: PDFMetadata = new canvasKit.PDFMetadata({
        title: pdfOptions?.title ?? "Document",
        author: pdfOptions?.author ?? "",
        subject: pdfOptions?.subject ?? "",
        keywords: pdfOptions?.keywords ?? "",
        creator: pdfOptions?.creator ?? "html2pdf-skia",
        producer: pdfOptions?.producer ?? "html2pdf-skia",
        rootTag: rootTag,
    });
    const fontManager = await inputProvider.getFontManager();
    if (!fontManager) {
        throw new Error("Font manager is not available");
    }
    const stream = new canvasKit.DynamicMemoryStream();
    const pdfDocument = canvasKit.MakePDFDocument(stream, metadata);
    if (!pdfDocument) {
        throw new Error("Failed to create PDF document");
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const nextPageElement = await inputProvider.getNextPageElement();
        if (!nextPageElement) {
            break; // No more pages to process
        }
        const pageWidth = pdfOptions?.pageSize?.width ?? 595; // Default A4 width
        const pageHeight = pdfOptions?.pageSize?.height ?? 842; // Default A4 height
        // Create a new page in the PDF document
        const canvas = pdfDocument.beginPage(
            pageWidth,
            pageHeight
        );
        if (!canvas) {
            throw new Error("Failed to create PDF page canvas");
        }
        const elementContainer = parseTree(context, nextPageElement);
        canvas.save();
        canvas.scale(1/window.devicePixelRatio, 1/window.devicePixelRatio);
        const renderer = new SkiaRenderer(
            context,
            {
                canvasKit,
                canvas,
                fontProvider: fontManager,
            }, {
                scale: 1,
                x: 0,
                y: 0,
                width: pageWidth*window.devicePixelRatio,
                height: pageHeight*window.devicePixelRatio,
                backgroundColor: null,
            });
        await renderer.render(elementContainer);
        canvas.restore();
        // render the page content
        pdfDocument.endPage();
    }
    pdfDocument.close();
    const buffer = stream.detachAsBytes();
    return new Blob([buffer], { type: "application/pdf" });
}

