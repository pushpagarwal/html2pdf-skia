import { PDFTag, PDFTagAttribute } from "canvaskit-wasm";

// Predefined special tag IDs from SkPDF
export const PREDEFINED_TAG_IDS = {
  Nothing: 0,
  OtherArtifact: -1,
  PaginationArtifact: -2,
  PaginationHeaderArtifact: -3,
  PaginationFooterArtifact: -4,
  PaginationWatermarkArtifact: -5,
  LayoutArtifact: -6,
  PageArtifact: -7,
  BackgroundArtifact: -8,
} as const;

// Standard PDF structure types
export const PDF_STRUCTURE_TYPES = {
  // Document structure
  Document: "Document",
  Part: "Part",
  Art: "Art",
  Sect: "Sect",
  Div: "Div",

  // Block-level structure
  P: "P", // Paragraph
  H1: "H1",
  H2: "H2",
  H3: "H3",
  H4: "H4",
  H5: "H5",
  H6: "H6", // Headings
  BlockQuote: "BlockQuote",
  Caption: "Caption",
  TOC: "TOC", // Table of Contents
  TOCI: "TOCI", // Table of Contents Item
  Index: "Index",

  // Inline structure
  Span: "Span",
  Quote: "Quote",
  Note: "Note",
  Reference: "Reference",
  BibEntry: "BibEntry",
  Code: "Code",
  Link: "Link",
  Annot: "Annot",

  // List structure
  L: "L", // List
  LI: "LI", // List Item
  Lbl: "Lbl", // List Label
  LBody: "LBody", // List Body

  // Table structure
  Table: "Table",
  TR: "TR", // Table Row
  TH: "TH", // Table Header
  TD: "TD", // Table Data
  THead: "THead", // Table Head
  TBody: "TBody", // Table Body
  TFoot: "TFoot", // Table Foot

  // Illustration structure
  Figure: "Figure",
  Formula: "Formula",
  Form: "Form",

  // Artifact (non-content elements)
  Artifact: "Artifact",
} as const;

// Custom PDF tag attribute name
export const PDF_TAG_ATTRIBUTE = "data-x-pdf-tag-id";

/**
 * Context for document structure generation
 */
interface DocumentStructureContext {
  nextId: number;
  tagIdMap: Map<Element, number>;
  rootTag: PDFTag;
}

/**
 * Generate unique tag ID
 */
function generateTagId(context: DocumentStructureContext): number {
  return context.nextId++;
}

/**
 * Apply PDF tag ID attribute to HTML element
 */
function applyTagIdToElement(element: Element, tagId: number): void {
  element.setAttribute(PDF_TAG_ATTRIBUTE, tagId.toString());
}

/**
 * Determine if element should be skipped entirely (not rendered in PDF)
 */
function shouldSkipElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role");

  // Skip head elements and non-rendered elements entirely
  if (
    [
      "head",
      "style",
      "script",
      "meta",
      "link",
      "title",
      "noscript",
      "template",
    ].includes(tagName)
  ) {
    return true;
  }

  // Skip elements with presentation role (not content)
  if (role === "presentation" || role === "none") {
    return true;
  }

  // Skip hidden elements
  if (element.hasAttribute("hidden")) {
    return true;
  }

  return false;
}

/**
 * Determine if element should be treated as artifact (decorative/non-content)
 */
function isArtifactElement(element: Element): boolean {
  const classList = element.classList;

  // Common CSS classes that indicate decorative elements
  const artifactClasses = [
    "decoration",
    "ornament",
    "background",
    "watermark",
    "separator",
  ];
  if (artifactClasses.some((cls) => classList.contains(cls))) {
    return true;
  }

  return false;
}

/**
 * Determine specific artifact type based on element characteristics
 */
function getArtifactType(element: Element): number {
  const classList = element.classList;
  const tagName = element.tagName.toLowerCase();

  if (classList.contains("header") || tagName === "header") {
    return PREDEFINED_TAG_IDS.PaginationHeaderArtifact;
  }
  if (classList.contains("footer") || tagName === "footer") {
    return PREDEFINED_TAG_IDS.PaginationFooterArtifact;
  }
  if (classList.contains("watermark")) {
    return PREDEFINED_TAG_IDS.PaginationWatermarkArtifact;
  }
  if (classList.contains("background") || classList.contains("bg")) {
    return PREDEFINED_TAG_IDS.BackgroundArtifact;
  }
  if (classList.contains("layout") || classList.contains("container")) {
    return PREDEFINED_TAG_IDS.LayoutArtifact;
  }
  if (classList.contains("page")) {
    return PREDEFINED_TAG_IDS.PageArtifact;
  }

  return PREDEFINED_TAG_IDS.OtherArtifact;
}

/**
 * Map HTML element to PDF structure type
 */
function getStructureType(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role");

  // Role attribute takes precedence
  switch (role) {
    case "document":
      return PDF_STRUCTURE_TYPES.Document;
    case "article":
      return PDF_STRUCTURE_TYPES.Art;
    case "section":
      return PDF_STRUCTURE_TYPES.Sect;
    case "paragraph":
      return PDF_STRUCTURE_TYPES.P;
    case "heading":
      return PDF_STRUCTURE_TYPES.H1; // Will be refined by level
    case "list":
      return PDF_STRUCTURE_TYPES.L;
    case "listitem":
      return PDF_STRUCTURE_TYPES.LI;
    case "table":
      return PDF_STRUCTURE_TYPES.Table;
    case "row":
      return PDF_STRUCTURE_TYPES.TR;
    case "cell":
      return PDF_STRUCTURE_TYPES.TD;
    case "columnheader":
    case "rowheader":
      return PDF_STRUCTURE_TYPES.TH;
    case "img":
    case "figure":
      return PDF_STRUCTURE_TYPES.Figure;
    case "link":
      return PDF_STRUCTURE_TYPES.Link;
    case "note":
      return PDF_STRUCTURE_TYPES.Note;
  }

  // Map based on HTML tag name
  switch (tagName) {
    case "html":
    case "body":
      return PDF_STRUCTURE_TYPES.Document;
    case "article":
      return PDF_STRUCTURE_TYPES.Art;
    case "section":
      return PDF_STRUCTURE_TYPES.Sect;
    case "div":
      return PDF_STRUCTURE_TYPES.Div;
    case "p":
      return PDF_STRUCTURE_TYPES.P;
    case "h1":
      return PDF_STRUCTURE_TYPES.H1;
    case "h2":
      return PDF_STRUCTURE_TYPES.H2;
    case "h3":
      return PDF_STRUCTURE_TYPES.H3;
    case "h4":
      return PDF_STRUCTURE_TYPES.H4;
    case "h5":
      return PDF_STRUCTURE_TYPES.H5;
    case "h6":
      return PDF_STRUCTURE_TYPES.H6;
    case "blockquote":
      return PDF_STRUCTURE_TYPES.BlockQuote;
    case "caption":
      return PDF_STRUCTURE_TYPES.Caption;
    case "span":
    case "em":
    case "strong":
    case "b":
    case "i":
      return PDF_STRUCTURE_TYPES.Span;
    case "q":
    case "cite":
      return PDF_STRUCTURE_TYPES.Quote;
    case "code":
    case "pre":
    case "kbd":
    case "samp":
      return PDF_STRUCTURE_TYPES.Code;
    case "a":
      return PDF_STRUCTURE_TYPES.Link;
    case "ol":
    case "ul":
    case "dl":
      return PDF_STRUCTURE_TYPES.L;
    case "li":
    case "dt":
    case "dd":
      return PDF_STRUCTURE_TYPES.LI;
    case "table":
      return PDF_STRUCTURE_TYPES.Table;
    case "thead":
      return PDF_STRUCTURE_TYPES.THead;
    case "tbody":
      return PDF_STRUCTURE_TYPES.TBody;
    case "tfoot":
      return PDF_STRUCTURE_TYPES.TFoot;
    case "tr":
      return PDF_STRUCTURE_TYPES.TR;
    case "th":
      return PDF_STRUCTURE_TYPES.TH;
    case "td":
      return PDF_STRUCTURE_TYPES.TD;
    case "img":
    case "svg":
    case "canvas":
    case "figure":
      return PDF_STRUCTURE_TYPES.Figure;
    case "form":
      return PDF_STRUCTURE_TYPES.Form;
    case "aside":
      return PDF_STRUCTURE_TYPES.Note;
    default:
      return PDF_STRUCTURE_TYPES.Span;
  }
}

/**
 * Create attributes for table elements
 */
function createTableAttributes(element: Element): PDFTagAttribute[] {
  const attributes: PDFTagAttribute[] = [];
  const tagName = element.tagName.toLowerCase();

  if (tagName === "table") {
    const rows = element.querySelectorAll("tr").length;
    const cols = Math.max(
      ...Array.from(element.querySelectorAll("tr")).map(
        (tr) => tr.children.length
      )
    );

    attributes.push(
      { owner: "Table", name: "RowCount", type: "int", value: rows },
      { owner: "Table", name: "ColCount", type: "int", value: cols }
    );
  } else if (tagName === "th" || tagName === "td") {
    const colspan = element.getAttribute("colspan");
    const rowspan = element.getAttribute("rowspan");

    if (colspan && parseInt(colspan) > 1) {
      attributes.push({
        owner: "Cell",
        name: "ColSpan",
        type: "int",
        value: parseInt(colspan),
      });
    }
    if (rowspan && parseInt(rowspan) > 1) {
      attributes.push({
        owner: "Cell",
        name: "RowSpan",
        type: "int",
        value: parseInt(rowspan),
      });
    }

    // Determine if it's a header cell
    if (
      tagName === "th" ||
      element.getAttribute("role") === "columnheader" ||
      element.getAttribute("role") === "rowheader"
    ) {
      attributes.push({
        owner: "Cell",
        name: "Scope",
        type: "name",
        value: element.getAttribute("scope") || "Col",
      });
    }
  }

  return attributes;
}

/**
 * Create attributes for list elements
 */
function createListAttributes(element: Element): PDFTagAttribute[] {
  const attributes: PDFTagAttribute[] = [];
  const tagName = element.tagName.toLowerCase();

  if (tagName === "ol") {
    const start = element.getAttribute("start");
    if (start) {
      attributes.push({
        owner: "List",
        name: "Start",
        type: "int",
        value: parseInt(start),
      });
    }

    const type = element.getAttribute("type");
    if (type) {
      attributes.push({
        owner: "List",
        name: "NumberFormat",
        type: "name",
        value: type,
      });
    }
  } else if (tagName === "ul") {
    const style = getComputedStyle(element).listStyleType;
    if (style && style !== "none") {
      attributes.push({
        owner: "List",
        name: "ListStyleType",
        type: "name",
        value: style,
      });
    }
  }

  return attributes;
}

/**
 * Create attributes for image elements
 */
function createImageAttributes(element: Element): PDFTagAttribute[] {
  const attributes: PDFTagAttribute[] = [];

  if (element.tagName.toLowerCase() === "img") {
    const img = element as HTMLImageElement;

    if (img.width) {
      attributes.push({
        owner: "Image",
        name: "Width",
        type: "float",
        value: img.width,
      });
    }
    if (img.height) {
      attributes.push({
        owner: "Image",
        name: "Height",
        type: "float",
        value: img.height,
      });
    }

    const placement = element.getAttribute("data-placement") || "Inline";
    attributes.push({
      owner: "Image",
      name: "Placement",
      type: "name",
      value: placement,
    });
  }

  return attributes;
}

/**
 * Create attributes for heading elements
 */
function createHeadingAttributes(element: Element): PDFTagAttribute[] {
  const attributes: PDFTagAttribute[] = [];
  const tagName = element.tagName.toLowerCase();

  if (tagName.match(/^h[1-6]$/)) {
    const level = parseInt(tagName.charAt(1));
    attributes.push({
      owner: "Heading",
      name: "Level",
      type: "int",
      value: level,
    });
  }

  return attributes;
}

/**
 * Create attributes based on element type
 */
function createElementAttributes(element: Element): PDFTagAttribute[] {
  const attributes: PDFTagAttribute[] = [];
  const tagName = element.tagName.toLowerCase();

  // Common attributes
  const id = element.id;
  if (id) {
    attributes.push({ owner: "Standard", name: "ID", type: "name", value: id });
  }

  const className = element.className;
  if (className) {
    attributes.push({
      owner: "Standard",
      name: "Class",
      type: "name",
      value: className,
    });
  }

  // Specific element attributes
  if (
    ["table", "th", "td", "thead", "tbody", "tfoot", "tr"].includes(tagName)
  ) {
    attributes.push(...createTableAttributes(element));
  } else if (["ol", "ul", "li"].includes(tagName)) {
    attributes.push(...createListAttributes(element));
  } else if (["img", "figure", "svg", "canvas"].includes(tagName)) {
    attributes.push(...createImageAttributes(element));
  } else if (tagName.match(/^h[1-6]$/)) {
    attributes.push(...createHeadingAttributes(element));
  }

  return attributes;
}

/**
 * Process a single HTML element and create corresponding PDF tag
 */
function processElement(
  element: Element,
  context: DocumentStructureContext
): PDFTag | null {
  // Skip elements that shouldn't be rendered in PDF
  if (shouldSkipElement(element)) {
    return null;
  }

  let tagId: number;
  let structureType: string;

  // Handle artifacts
  if (isArtifactElement(element)) {
    tagId = getArtifactType(element);
    structureType = PDF_STRUCTURE_TYPES.Artifact;
  } else {
    tagId = generateTagId(context);
    structureType = getStructureType(element);
  }

  // Apply tag ID to HTML element
  applyTagIdToElement(element, tagId);
  context.tagIdMap.set(element, tagId);

  // Create PDF tag
  const pdfTag: PDFTag = {
    id: tagId,
    type: structureType,
    alt:
      element.getAttribute("alt") ||
      element.getAttribute("aria-label") ||
      undefined,
    language: element.getAttribute("lang") || undefined,
    attributes: createElementAttributes(element),
    children: [],
  };

  // Process child elements
  const childElements = Array.from(element.children);
  for (const child of childElements) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childTag = processElement(child, context);
      // Only add non-null child tags
      if (childTag) {
        pdfTag.children?.push(childTag);
      }
    }
  }

  return pdfTag;
}

/**
 * Generate document structure from HTML tree
 */
export function generateDocumentStructure(htmlElement: Element | Element[]): {
    structure: PDFTag;
    tagIdMap: Map<Element, number>;
} {
    const context: DocumentStructureContext = {
        nextId: 1, // Start from 1, as 0 is reserved for Nothing
        tagIdMap: new Map(),
        rootTag: {
            id: 0,
            type: PDF_STRUCTURE_TYPES.Document,
            children: [],
        },
    };

    // Handle array of elements
    if (Array.isArray(htmlElement)) {
        const parentTag: PDFTag = {
            id: 0,
            type: PDF_STRUCTURE_TYPES.Document,
            children: [],
        };

        // Process each element in the array
        for (const element of htmlElement) {
            const childTag = processElement(element, context);
            if (childTag) {
                parentTag.children?.push(childTag);
            }
        }

        return {
            structure: parentTag,
            tagIdMap: context.tagIdMap,
        };
    }

    // Handle single element (existing logic)
    const documentStructure = processElement(htmlElement, context);

    // If the root element was skipped, create a minimal document structure
    if (!documentStructure) {
        return {
            structure: {
                id: 0,
                type: PDF_STRUCTURE_TYPES.Document,
                children: [],
            },
            tagIdMap: context.tagIdMap,
        };
    }

    return {
        structure: documentStructure,
        tagIdMap: context.tagIdMap,
    };
}

/**
 * Apply PDF structure to existing HTML document
 */
export function applyPDFStructureToDocument(document: Document): {
  structure: PDFTag;
  tagIdMap: Map<Element, number>;
} {
  const htmlElement = document.documentElement;
  return generateDocumentStructure(htmlElement);
}

/**
 * Get PDF tag for specific HTML element
 */
export function getPDFTagForElement(
  element: Element,
  tagIdMap: Map<Element, number>
): number | undefined {
  return tagIdMap.get(element);
}

/**
 * Serialize PDF structure to JSON for debugging
 */
export function serializePDFStructure(structure: PDFTag): string {
  return JSON.stringify(structure, null, 2);
}

/**
 * Validate PDF structure integrity
 */
export function validatePDFStructure(structure: PDFTag): boolean {
  const validateTag = (tag: PDFTag, visitedIds: Set<number>): boolean => {
    // Check for duplicate IDs (except predefined negative IDs)
    if (tag.id !== undefined && tag.id > 0 && visitedIds.has(tag.id)) {
      console.error(`Duplicate tag ID found: ${tag.id}`);
      return false;
    }

    if (tag.id !== undefined && tag.id > 0) {
      visitedIds.add(tag.id);
    }

    // Validate children
    if (tag.children) {
      for (const child of tag.children) {
        if (!validateTag(child, visitedIds)) {
          return false;
        }
      }
    }

    return true;
  };

  return validateTag(structure, new Set());
}
