export { exportHTMLDocumentToPdf } from "./pdf/single-html-multi-page";
export type { ExportPdfOptions } from "./pdf/single-html-multi-page";


export { loadCanvasKit, preloadCanvasKit } from "./pdf/canvaskit-loader";
export type { CanvasKitLoadOptions } from "./pdf/canvaskit-loader";
export { isCanvasKitLoaded, getCanvasKitInstance } from "./pdf/canvaskit-loader";

export * from './fonts/interfaces';
export { createFontCollection } from "./fonts/font-collection";