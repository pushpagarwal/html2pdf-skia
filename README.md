# html2pdf-skia

**Create vector PDFs from rendered HTML documents in the browser**

html2pdf-skia generates high-quality PDFs directly from HTML/CSS content using Google's Skia graphics engine. Unlike other libraries that embed rasterized images into PDFs, html2pdf-skia produces true vector graphics with selectable text, making the output both lightweight and accessible.

## Why html2pdf-skia

The existing html2pdf library, while popular, **failed to meet our requirements** for accessible PDF generation. Its fundamental approach of embedding rasterized images into PDF pages creates several critical limitations:

**❌ What html2pdf couldn't deliver:**
- **Inaccessible PDFs** - Text becomes unselectable images, failing screen reader compatibility
- **Poor searchability** - Content cannot be indexed, searched, or extracted
- **Large file sizes** - Rasterized images dramatically increase PDF size
- **Low print quality** - Pixelated output when printed at high resolutions
- **No accessibility compliance** - Fails to meet WCAG and Section 508 standards

**✅ Why we built html2pdf-skia as the solution:**

Since html2pdf couldn't meet our accessibility and quality requirements, we created html2pdf-skia as a complete reimagining of HTML-to-PDF conversion. Our improved version leverages Google's Skia graphics engine to deliver:

- **True vector PDFs** - Text and graphics remain live, selectable, and searchable
- **Full accessibility compliance** - Tagged PDFs work seamlessly with screen readers
- **Superior quality** - Vector graphics scale perfectly at any resolution
- **Smaller file sizes** - Efficient vector encoding vs. embedded images
- **Professional output** - Publication-ready PDFs that meet enterprise standards

html2pdf-skia isn't just an alternative—it's the next-generation solution that addresses every limitation of the original html2pdf library.

## ✨ Key Features

- **🎯 Vector Graphics**: True vector PDF output with crisp text and graphics at any zoom level
- **♿ Accessible PDFs**: Generated PDFs are tagged and screen-reader compatible
- **📝 Selectable Text**: All text remains selectable and searchable in the final PDF
- **🎨 Full CSS Support**: Comprehensive support for modern CSS features including:
  - Flexbox and Grid layouts
  - CSS transforms and animations
  - Custom fonts and web fonts
  - Complex backgrounds and gradients
  - Box shadows and text effects
- **📄 Multi-page Support**: Automatic page breaks and multi-page document generation
- **🔤 Advanced Typography**: Font fallback system and international text support
- **⚡ Browser-based**: Runs entirely in the browser without server dependencies

## 🚀 Background

html2pdf-skia is a fork of the popular [html2canvas](https://github.com/niklasvh/html2canvas) library. Instead of rendering to an HTML5 Canvas, it uses Google's Skia graphics engine (via CanvasKit) to generate PDF documents directly. This approach provides:

- Better text rendering and typography
- True vector output instead of rasterized images  
- Smaller file sizes for text-heavy documents
- Improved accessibility and searchability
- Professional-quality PDF output

## 📦 Installation

```bash
npm install html2pdf-skia
```

## 🔧 Basic Usage

### Simple PDF Generation

```typescript
import { exportHTMLDocumentToPdf, createFontCollection } from 'html2pdf-skia';
import { loadCanvasKit } from 'html2pdf-skia/canvaskit-loader';

async function generatePDF() {
  // Load CanvasKit WASM module
  const canvasKit = await loadCanvasKit({
    wasmBinaryUrl: '/path/to/canvaskit-pdf.wasm'
  });

  // setup Font Collection, fonts and Fallback
  const fontCollection = createFontCollection(canvasKit);
  const robotoBuffer = await fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer());
  fontCollection.addFont(robotoBuffer, 'Roboto');
  fontCollection.setDefaultFonts('sans-serif', ['Roboto']);

  // Generate PDF from current document
  const pdfBlob = await exportHTMLDocumentToPdf(canvasKit, document, {
    pageSize: { width: 595, height: 842 }, // A4 size in points
    title: "My Document",
    author: "John Doe",
    fontCollection
  });

  // Download the PDF
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'document.pdf';
  link.click();
  URL.revokeObjectURL(url);
}
```

### Advanced Configuration

```typescript
import { exportHTMLDocumentToPdf, createFontCollection } from 'html2pdf-skia';
import { loadCanvasKit } from 'html2pdf-skia/canvaskit-loader';

async function generateAdvancedPDF() {
  const canvasKit = await loadCanvasKit({
    wasmBinaryUrl: '/canvaskit.wasm',
    timeout: 10000,
    verbose: true
  });

  // setup Font Collection, fonts and Fallback
  const fontCollection = createFontCollection(canvasKit);
  const robotoBuffer = await fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer());
  fontCollection.addFont(robotoBuffer, 'Roboto');
  fontCollection.setDefaultFonts('sans-serif', ['Roboto']);

  const pdfBlob = await exportHTMLDocumentToPdf(canvasKit, document, {
    // Page configuration
    pageSize: { width: 595, height: 842 },
    
    // PDF metadata
    title: "Annual Report 2024",
    author: "Company Name",
    subject: "Financial Report",
    keywords: "annual, report, financial, 2024",
    creator: "html2pdf-skia",
    producer: "html2pdf-skia v1.0",
    language: "en-US",
    
    fontCollection
  });

  return pdfBlob;
}
```

## 🔤 Font Management and Fallback

Since Skia is a JS/WASM-based library and browsers don't provide access to local system fonts, it's the client's responsibility to provide font files. html2pdf-skia offers a powerful font collection system that handles custom fonts, fallbacks, and missing glyph detection:

### Using Font Collections

```typescript
import { createFontCollection } from 'html2pdf-skia';
import { loadCanvasKit } from 'html2pdf-skia/canvaskit-loader';

async function generatePDFWithFonts() {
  const canvasKit = await loadCanvasKit({
    wasmBinaryUrl: '/canvaskit.wasm'
  });

  // Create a font collection
  const fontCollection = createFontCollection(canvasKit);

  // Load custom fonts
  const robotoBuffer = await fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer());
  const robotoBoldBuffer = await fetch('/fonts/Roboto-Bold.ttf').then(r => r.arrayBuffer());
  
  // Add fonts to the collection
  fontCollection.addFont(robotoBuffer, 'Roboto');
  fontCollection.addFont(robotoBoldBuffer, 'Roboto', { fontWeight: 700 });

  // Set default fonts for font families
  fontCollection.setDefaultFonts('sans-serif', ['Roboto', 'Arial', 'Helvetica']);
  fontCollection.setDefaultFonts('serif', ['Times New Roman', 'Georgia']);

  // Set fallback fonts for Unicode character categories
  fontCollection.setFallbackFonts('emoji', ['Apple Color Emoji', 'Segoe UI Emoji']);
  fontCollection.setFallbackFonts('cjk', ['Microsoft YaHei', 'SimHei']);

  // Generate PDF with font collection
  const pdfBlob = await exportHTMLDocumentToPdf(canvasKit, document, {
    fontCollection: fontCollection,
    pageSize: { width: 595, height: 842 }
  });

  return pdfBlob;
}
```

### Advanced Font Configuration

```typescript
import { createFontCollection, type IFontCollection } from 'html2pdf-skia';

async function setupAdvancedFonts(canvasKit: CanvasKit): Promise<IFontCollection> {
  const fontCollection = createFontCollection(canvasKit);

  // Load multiple font weights and styles
  const fontConfig = [
    { url: '/fonts/Inter-Regular.woff2', family: 'Inter', weight: 400 },
    { url: '/fonts/Inter-Medium.woff2', family: 'Inter', weight: 500 },
    { url: '/fonts/Inter-Bold.woff2', family: 'Inter', weight: 700 },
    { url: '/fonts/Inter-Italic.woff2', family: 'Inter', weight: 400, slant: 'italic' },
    { url: '/fonts/JetBrainsMono-Regular.woff2', family: 'JetBrains Mono', weight: 400 },
    { url: '/fonts/NotoColorEmoji.ttf', family: 'Noto Color Emoji' }
  ];

  // Load all fonts
  for (const config of fontConfig) {
    try {
      const buffer = await fetch(config.url).then(r => r.arrayBuffer());
      fontCollection.addFont(buffer, config.family, {
        fontWeight: config.weight,
        fontSlant: config.slant as 'normal' | 'italic' | 'oblique'
      });
    } catch (error) {
      console.warn(`Failed to load font ${config.family}:`, error);
    }
  }

  // Configure font family defaults
  fontCollection.setDefaultFonts('sans-serif', ['Inter', 'Arial', 'Helvetica']);
  fontCollection.setDefaultFonts('monospace', ['JetBrains Mono', 'Courier New', 'Monaco']);
  fontCollection.setDefaultFonts('serif', ['Times New Roman', 'Georgia']);

  // Configure Unicode fallbacks
  fontCollection.setFallbackFonts('emoji', ['Noto Color Emoji', 'Apple Color Emoji']);
  fontCollection.setFallbackFonts('cjk', ['Microsoft YaHei', 'SimHei', 'STHeiti']);
  fontCollection.setFallbackFonts('symbol', ['Arial Unicode MS', 'Segoe UI Symbol']);

  return fontCollection;
}
```

### Font Detection and Missing Glyph Analysis

```typescript
// Analyze document for missing fonts and glyphs
function analyzeFontRequirements(fontCollection: IFontCollection, element: HTMLElement) {
  // Get missing fonts for the element
  const missingFonts = fontCollection.getMissingFonts(element);
  if (missingFonts.length > 0) {
    console.log('Missing fonts:', missingFonts.map(f => f.families.join(', ')));
  }

  // Get missing glyph categories
  const missingGlyphCategories = fontCollection.getMissingGlyphsCategories(element, {});
  if (missingGlyphCategories.length > 0) {
    console.log('Missing glyph categories:', missingGlyphCategories);
    
    // Handle missing categories
    for (const category of missingGlyphCategories) {
      switch (category) {
        case 'emoji':
          console.warn('Consider adding emoji font fallbacks');
          break;
        case 'cjk':
          console.warn('Consider adding CJK (Chinese/Japanese/Korean) font fallbacks');
          break;
        case 'symbol':
          console.warn('Consider adding symbol font fallbacks');
          break;
      }
    }
  }
}
```

### Font Collection API Reference

The `IFontCollection` interface provides these methods:

#### `addFont(buffer: ArrayBuffer, family: string, fontStyle?: IFontStyle): void`
Adds a font buffer to the collection.

#### `setDefaultFonts(fontFamilyClass: FontFamilyClass, families: string[]): void`
Sets default fonts for CSS font family classes:
- `'serif'` | `'sans-serif'` | `'monospace'` | `'cursive'` | `'fantasy'` | `'fangsong'`

#### `setFallbackFonts(unicodeCharacterBucket: UnicodeCharacterBucket, families: string[]): void`
Sets fallback fonts for Unicode character categories:
- `'cjk'` - Chinese, Japanese, Korean characters
- `'emoji'` - Emoji characters
- `'symbol'` - Mathematical symbols, arrows, etc.
- `'unicode'` - General Unicode fallback

#### `getMissingFonts(element: HTMLElement): IFontProperties[]`
Analyzes an HTML element and returns missing font properties.

#### `getMissingGlyphsCategories(element: HTMLElement, fontStyle: IFontStyle): string[]`
Detects which Unicode character categories have missing glyphs:
- `'cjk'` - Chinese, Japanese, Korean characters
- `'emoji'` - Emoji characters
- `'symbol'` - Mathematical symbols, arrows, etc.
- `'unicode'` - General Unicode fallback

### Font Style Configuration

```typescript
interface IFontStyle {
  fontWeight?: number;    // 100-900 (default: 400)
  fontWidth?: 'normal' | 'narrow' | 'wide';
  fontSlant?: 'normal' | 'italic' | 'oblique';
}

interface IFontProperties extends IFontStyle {
  families: string[];     // Font family names in priority order
}
```

### Automatic Features

The font collection system automatically:
- **Scans documents** for used fonts and styles
- **Detects missing glyphs** by analyzing text content against available typefaces
- **Categorizes missing characters** into Unicode buckets for targeted fallback loading
- **Provides fallback typefaces** when primary fonts don't contain required glyphs
- **Handles international text** including CJK characters, emojis, and symbols
- **Optimizes performance** by caching font managers and typeface instances

## 📐 Page Configuration

### Standard Page Sizes

```typescript
// Common page sizes (in points)
const pageSizes = {
  A4: { width: 595, height: 842 },
  A3: { width: 842, height: 1191 },
  A5: { width: 420, height: 595 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 }
};
```

### Custom Page Sizes

```typescript
const options = {
  pageSize: { 
    width: 800,   // Custom width in points
    height: 600   // Custom height in points
  }
};
```

## 🎯 CSS Features Support

html2pdf-skia supports a comprehensive set of CSS features:

### Layout
- ✅ Flexbox (`display: flex`)
- ✅ CSS Grid (`display: grid`)
- ✅ Positioning (`relative`, `absolute`, `fixed`)
- ✅ Floats and clearing
- ✅ Box model (margin, padding, border)

### Typography
- ✅ Custom fonts and web fonts
- ✅ Font fallbacks
- ✅ Text shadows
- ✅ Text decorations (underline, overline, line-through)
- ✅ Letter spacing and line height
- ✅ Text alignment and direction

### Visual Effects
- ✅ Box shadows
- ✅ Border radius
- ✅ Gradients (linear and radial)
- ✅ Background images
- ✅ CSS transforms
- ✅ Opacity and transparency

### Content
- ✅ Images (PNG, JPEG, SVG, WebP)
- ✅ Canvas elements
- ✅ Iframe content
- ✅ Form elements (styled)
- ✅ List markers and counters

## 🔧 API Reference

### `exportHTMLDocumentToPdf(canvasKit, document, options)`

Generates a PDF from an HTML document.

**Parameters:**
- `canvasKit`: CanvasKit WASM instance
- `document`: HTML Document to convert
- `options`: Configuration options (optional)

**Returns:** `Promise<Blob>` - PDF file as a Blob

### `loadCanvasKit(options)`

Loads the CanvasKit WASM module.

**Parameters:**
- `options.wasmBinaryUrl`: Path to CanvasKit WASM file
- `options.timeout`: Loading timeout in ms (default: 30000)
- `options.verbose`: Enable logging (default: false)

**Returns:** `Promise<CanvasKit>` - CanvasKit instance

## 🔍 Troubleshooting

### Common Issues

**WASM Loading Errors**
```typescript
// Ensure correct WASM path
const canvasKit = await loadCanvasKit({
  wasmBinaryUrl: './node_modules/html2pdf-skia/lib/wasm/canvaskit-pdf.wasm'
});
```

**Font Loading Issues**
```typescript
// Create font collection and add fallback fonts
const fontCollection = createFontCollection(canvasKit);
fontCollection.setDefaultFonts('sans-serif', ['Arial']);
fontCollection.setFallbackFonts('emoji', ['Apple Color Emoji']);
```

**Large Document Performance**
```typescript
// Use appropriate page sizes and optimize font loading
const options = {
  pageSize: { width: 595, height: 842 }, // A4
  fontCollection: fontCollection
};
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

## 🙏 Acknowledgments

- Built on top of [html2canvas](https://github.com/niklasvh/html2canvas)
- Powered by [Google Skia](https://skia.org/) via CanvasKit
- Inspired by the need for accessible, vector-based PDF generation
