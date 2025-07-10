import { PDFTag, FontMgr, CanvasKit } from "canvaskit-wasm";
import { exportToPdf, FontLoader, IPageSize, IPdfInputProvider, IPdfOptions } from "./pdf-export";
import { applyPDFStructureToDocument } from "./document-structure";
import { HtmlPageBreak } from "./html-page-break";
import { enumerateFonts } from "./font-enumeration";
import {
  CloneConfigurations,
  DocumentCloner,
} from "../dom/document-cloner";
import { Context, ContextOptions } from "../core/context";
import { Bounds } from "../css/layout/bounds";
import { appendPageStyles } from "./dom-updates";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SingleHtmlMultiPageProvider implements IPdfInputProvider {
    private document: Document;
    private currentPageIndex: number = 0;
    private htmlPageBreak: HtmlPageBreak;
    private fontLoader: (fontList: string[]) => Promise<FontMgr>;

    constructor(document: Document, pageSize: IPageSize, fontLoader: (fontList: string[]) => Promise<FontMgr>) {
        this.document = document;
        this.htmlPageBreak = new HtmlPageBreak(document, pageSize.height);
        this.fontLoader = fontLoader;
    }

    getDocumentStructure(): PDFTag {
        const structure = applyPDFStructureToDocument(this.document);
        return structure.structure;
    }

    async getFontManager(): Promise<FontMgr> {
        const fontFamilies = enumerateFonts([this.document.body]);
        return this.fontLoader(Array.from(fontFamilies));
    }

    async getNextPageElement(): Promise<HTMLElement | null> {
        if(this.currentPageIndex > 0){
            this.htmlPageBreak.postProcess(); // Post process to handle previous page items
            await delay(0); // Yield to allow other tasks to run
        }
        this.currentPageIndex++;
        const nextPage =  this.htmlPageBreak.processPage();
        await delay(0); // Yield to allow other tasks to run
        return nextPage;
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

const getFontLoader = (canvasKit: CanvasKit, fontLoader?: FontLoader): (familyNames: string[]) => Promise<FontMgr> => {
    let fontMgr: FontMgr | null = null;
    if(fontLoader) {
        return async (fontList: string[]) => {
            const fontBuffers = await fontLoader(fontList);
            fontMgr = canvasKit.FontMgr.FromData(...fontBuffers);
            return fontMgr ?? canvasKit.TypefaceFontProvider.Make();
        };       
    }

    return (_:string[]) => Promise.resolve(canvasKit.TypefaceFontProvider.Make());
};


export async function exportHTMLDocumentToPdf(
    canvasKit: CanvasKit,
    document: Document,
    options: Partial<ExportPdfOptions>
): Promise<Blob> {
   const pageSize = {
       width: options.pageSize?.width ?? 595,
       height: options.pageSize?.height ?? 842,
   };
   const pageBounds = new Bounds(0, 0, pageSize.width, pageSize.height);
   const context = new Context(getContextOptions(options), pageBounds);
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
       width: pageSize.width * window.devicePixelRatio,
       height: pageSize.height * window.devicePixelRatio,
   };
   const container = await documentCloner.toIFrame(document, new Bounds(0, 0, devicePageSize.width, devicePageSize.height));
   appendPageStyles(clonedElement.ownerDocument);
   const fontLoader = getFontLoader(canvasKit, options.fontLoader);

   const pdfInputProvider = new SingleHtmlMultiPageProvider(clonedElement.ownerDocument, devicePageSize, fontLoader);
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