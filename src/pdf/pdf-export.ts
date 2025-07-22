import { CanvasKit, PDFMetadata, PDFTag } from "@rollerbird/canvaskit-wasm-pdf";
import { parseBackgroundColor, parseTree } from "../dom/node-parser";
import { Context } from "../core/context";
import { SkiaRenderer } from "../render/skia/skia-renderer";
import { IFontCollection } from "../fonts/interfaces";
import { SkiaFontCollection } from "../fonts/font-collection";

export const defaultUserToPdfScale = 0.5; // Default scale for PDF rendering
export interface IPageSize {
    width: number;
    height: number;
}
export interface IPdfInputProvider {
    getDocumentTitle(): string;
    getDocumentStructure(): PDFTag;
    getNextPageElement(): Promise<HTMLElement | null>;
}


export interface IPdfOptions {
    title: string;
    author: string;
    subject: string;
    keywords: string;
    creator: string;
    producer: string;
    language?: string;
    userToPdfScale?: number;
    pageSize: { width: number; height: number };
    fontCollection?: IFontCollection;
}

export async function exportToPdf(
    canvasKit: CanvasKit,
    context: Context,
    inputProvider: IPdfInputProvider,
    pdfOptions?: Partial<IPdfOptions>): Promise<Blob> {
    const rootTag = inputProvider.getDocumentStructure();
    const metadata: PDFMetadata = {
        title: pdfOptions?.title ?? inputProvider.getDocumentTitle(),
        author: pdfOptions?.author ?? "",
        subject: pdfOptions?.subject ?? "",
        keywords: pdfOptions?.keywords ?? "",
        creator: pdfOptions?.creator ?? "html2pdf-skia",
        producer: pdfOptions?.producer ?? "html2pdf-skia",
        language: pdfOptions?.language ?? "en-US",
        rootTag: rootTag,
    };
    const pdfDocument = canvasKit.MakePDFDocument(metadata);
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
        const documentElement = nextPageElement.ownerDocument.documentElement;
        const backgroundColor = parseBackgroundColor(
            context,
            documentElement
        );
        const userToPdfScale = pdfOptions?.userToPdfScale ?? defaultUserToPdfScale;
        const elementContainer = parseTree(context, nextPageElement);
        canvas.save();
        canvas.scale(userToPdfScale, userToPdfScale);
        const renderer = new SkiaRenderer(
            context,
            {
                canvasKit,
                canvas,
            }, {
            scale: 1,
            x: 0,
            y: 0,
            width: pageWidth * window.devicePixelRatio,
            height: pageHeight * window.devicePixelRatio,
            backgroundColor: backgroundColor,
            fontCollection: (pdfOptions?.fontCollection as SkiaFontCollection)?? new SkiaFontCollection(canvasKit),
        });
        await renderer.render(elementContainer);
        canvas.restore();
        // render the page content
        pdfDocument.endPage();
    }
    const buffer = pdfDocument.close();
    pdfDocument.delete();
    return new Blob([buffer], { type: "application/pdf" });
}

