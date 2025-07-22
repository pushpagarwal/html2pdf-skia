import { PDFTag, CanvasKit } from "@rollerbird/canvaskit-wasm-pdf";
import { defaultUserToPdfScale, exportToPdf, IPageSize, IPdfInputProvider, IPdfOptions } from "./pdf-export";
import { applyPDFStructureToDocument } from "./document-structure";
import { HtmlPageBreak } from "./html-page-break";
import {
  CloneConfigurations,
  DocumentCloner,
} from "../dom/document-cloner";
import { Context, ContextOptions } from "../core/context";
import { Bounds } from "../css/layout/bounds";
import { appendPageStyles } from "./dom-updates";
import { SkiaFontCollection } from "../fonts/font-collection";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SingleHtmlMultiPageProvider implements IPdfInputProvider {
    private document: Document;
    private currentPageIndex: number = 0;
    private htmlPageBreak: HtmlPageBreak;

    constructor(document: Document, pageSize: IPageSize) {
        this.document = document;
        this.htmlPageBreak = new HtmlPageBreak(document, pageSize.height);
    }

    getDocumentStructure(): PDFTag {
        const structure = applyPDFStructureToDocument(this.document);
        return structure.structure;
    }

    
    async getNextPageElement(): Promise<HTMLElement | null> {
        if(this.currentPageIndex > 0){
            this.htmlPageBreak.postProcess(); // Post process to handle previous page items
        }
        await delay(0); // Yield to allow other tasks to run
        this.currentPageIndex++;
        const nextPage =  this.htmlPageBreak.processPage();
        await delay(0); // Yield to allow other tasks to run
        return nextPage;
    }
    getDocumentTitle(): string {
        return this.document.title || "Document";
    }
    
}


function getContextOptions(
    options: Partial<ExportPdfOptions>
): ContextOptions {
    return {
        logging: options.logging ?? false,
        cache: options.cache,
        imageTimeout: options.imageTimeout ?? 15000,
        useCORS: options.useCORS ?? true,
        allowTaint: options.allowTaint ?? false,
        proxy: options.proxy,
        customIsSameOrigin: options.customIsSameOrigin,
    };
}

export type ExportPdfOptions = ContextOptions & IPdfOptions;

export async function exportHTMLDocumentToPdf(
    canvasKit: CanvasKit,
    document: Document,
    options: Partial<ExportPdfOptions>
): Promise<Blob> {
   const pageSize = {
       width: options.pageSize?.width ?? 595,
       height: options.pageSize?.height ?? 842,
   };
   const userToPdfScale = options?.userToPdfScale ?? defaultUserToPdfScale;
   const pageBounds = new Bounds(0, 0, pageSize.width, pageSize.height);
   const context = new Context(getContextOptions(options), pageBounds, options.fontCollection as SkiaFontCollection);
   const cloneOptions: CloneConfigurations = {
      inlineImages: false,
      copyStyles: false,
   };
   const documentCloner = new DocumentCloner(context, document.body, cloneOptions);
   const clonedElement = documentCloner.clonedReferenceElement;
   if (!clonedElement) {
       throw new Error("Unable to find element in cloned document");
   }
    const devicePageSize = {
       width: pageSize.width * 1 / userToPdfScale,
       height: pageSize.height * 1 / userToPdfScale,
   };
   const container = await documentCloner.toIFrame(document, new Bounds(0, 0, devicePageSize.width, devicePageSize.height));
   appendPageStyles(clonedElement.ownerDocument);
   const iframeDocument = clonedElement.ownerDocument;
   iframeDocument.title = document.title || "Document";
   await (options.fontCollection as SkiaFontCollection)?.addFontsToDocument(iframeDocument);
   const pdfInputProvider = new SingleHtmlMultiPageProvider(iframeDocument, devicePageSize);
   const blob = await exportToPdf(
       canvasKit,
       context,
       pdfInputProvider,
       options);

    if (!DocumentCloner.destroy(container)) {
      context.logger.error(
        `Cannot detach cloned iframe as it is not in the DOM anymore`
      );
    }   
   return blob;
}