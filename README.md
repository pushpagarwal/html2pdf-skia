# html2pdf-skia

**Create vector PDFs from rendered HTML documents in the browser**

html2pdf-skia generates high-quality PDFs directly from HTML/CSS content using Google's Skia graphics engine. Unlike other libraries that embed rasterized images into PDFs, html2pdf-skia produces true vector graphics with selectable text, making the output both lightweight and accessible.

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
import { exportHTMLDocumentToPdf } from 'html2pdf-skia';
import { loadCanvasKit } from 'html2pdf-skia/canvaskit-loader';

async function generatePDF() {
  // Load CanvasKit WASM module
  const canvasKit = await loadCanvasKit({
    wasmBinaryUrl: '/path/to/canvaskit.wasm'
  });

  // Generate PDF from current document
  const pdfBlob = await exportHTMLDocumentToPdf(canvasKit, document, {
    pageSize: { width: 595, height: 842 }, // A4 size in points
    title: "My Document",
    author: "John Doe"
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
import { exportHTMLDocumentToPdf } from 'html2pdf-skia';
import { loadCanvasKit } from 'html2pdf-skia/canvaskit-loader';

async function generateAdvancedPDF() {
  const canvasKit = await loadCanvasKit({
    wasmBinaryUrl: '/canvaskit.wasm',
    timeout: 10000,
    verbose: true
  });

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
    
    // Rendering options
    scale: 1,
    useCORS: true,
    allowTaint: false,
    logging: true,
    imageTimeout: 15000,
    
    // Font configuration
    fontLoader: async (fontList) => {
      // Load custom fonts
      const fontBuffers = await Promise.all(
        fontList.map(font => fetch(`/fonts/${font}.woff2`).then(r => r.arrayBuffer()))
      );
      return fontBuffers;
    },
    
    // Font fallback configuration
    fallbackFonts: {
      'sans-serif': ['Arial', 'Helvetica', 'DejaVu Sans'],
      'serif': ['Times New Roman', 'Georgia', 'DejaVu Serif'],
      'monospace': ['Courier New', 'Monaco', 'DejaVu Sans Mono'],
      'emoji': ['Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji']
    }
  });

  return pdfBlob;
}
```

### Targeting Specific Elements

```typescript
// Create a wrapper for specific content
const element = document.getElementById('content-to-convert');
const tempDocument = document.implementation.createHTMLDocument('PDF Content');
tempDocument.body.appendChild(element.cloneNode(true));

const pdfBlob = await exportHTMLDocumentToPdf(canvasKit, tempDocument, options);
```

## 🔤 Font Management and Fallback

html2pdf-skia provides sophisticated font handling capabilities:

### Custom Font Loading

```typescript
const options = {
  fontLoader: async (fontFamilies: string[]) => {
    const fontBuffers: ArrayBuffer[] = [];
    
    for (const family of fontFamilies) {
      try {
        // Load font from your server or CDN
        const response = await fetch(`/fonts/${family}.woff2`);
        if (response.ok) {
          fontBuffers.push(await response.arrayBuffer());
        }
      } catch (error) {
        console.warn(`Failed to load font: ${family}`);
      }
    }
    
    return fontBuffers;
  }
};
```

### Font Fallback Configuration

```typescript
const options = {
  fallbackFonts: {
    // Define fallback chains for different font categories
    'Roboto': ['Roboto', 'Arial', 'Helvetica', 'sans-serif'],
    'Open Sans': ['Open Sans', 'Arial', 'Helvetica', 'sans-serif'],
    'Playfair Display': ['Playfair Display', 'Georgia', 'serif'],
    
    // System font fallbacks
    'sans-serif': ['Arial', 'Helvetica', 'Segoe UI', 'DejaVu Sans'],
    'serif': ['Times New Roman', 'Georgia', 'DejaVu Serif'],
    'monospace': ['Courier New', 'Monaco', 'Consolas', 'DejaVu Sans Mono'],
    
    // International and emoji support
    'emoji': ['Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'],
    'chinese': ['Microsoft YaHei', 'SimHei', 'STHeiti'],
    'japanese': ['Hiragino Sans', 'Yu Gothic', 'Meiryo'],
    'korean': ['Malgun Gothic', 'Dotum', 'AppleGothic']
  }
};
```

### Automatic Font Detection

The library automatically:
- Scans your document for used fonts
- Attempts to load them via the `fontLoader` function
- Falls back to system fonts when custom fonts aren't available
- Handles missing glyphs gracefully with fallback fonts

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
  wasmBinaryUrl: './node_modules/html2pdf-skia/dist/canvaskit.wasm'
});
```

**Font Loading Issues**
```typescript
// Provide fallback fonts
const options = {
  fallbackFonts: {
    'custom-font': ['Arial', 'sans-serif']
  }
};
```

**Large Document Performance**
```typescript
// Optimize for large documents
const options = {
  scale: 0.75,        // Reduce scale for faster processing
  imageTimeout: 5000, // Reduce image timeout
  logging: true       // Enable logging to track progress
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
