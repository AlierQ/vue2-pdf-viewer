# vue2-pdf-viewer

Vue 2 PDF viewer component with annotation support, built on [pdfjs-dist](https://github.com/mozilla/pdf.js).

## Features

- Canvas-based PDF page rendering
- Page navigation (prev/next)
- Annotation overlay: Link, Highlight, Underline, StrikeOut, Text, FreeText
- Click to toggle annotation details (author, date, content)
- Custom annotation marker icon
- CMap support for CJK text (Chinese, Japanese, Korean)
- High-DPI / Retina display support

## Installation

```bash
npm install vue2-pdf-viewer
```

## Quick Start

```vue
<template>
  <VuePdfViewer pdfUrl="https://example.com/document.pdf" />
</template>

<script>
import VuePdfViewer from 'vue2-pdf-viewer'

export default {
  components: { VuePdfViewer }
}
</script>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pdfUrl` | `String` | *required* | PDF file URL or data URL |
| `annotationIcon` | `String` | `''` | Custom SVG string or `require()` path for annotation markers |

## Annotation Icon

```vue
<!-- Via require -->
<VuePdfViewer pdfUrl="doc.pdf" :annotationIcon="require('@/assets/note.svg')" />

<!-- Inline SVG -->
<VuePdfViewer pdfUrl="doc.pdf" :annotationIcon="svgString" />
```

## CMap (CJK Font Support)

For Chinese/Japanese/Korean text rendering, CMap files must be available at `/cmaps/`.

**Dev (webpack-dev-server):**
```js
// webpack.config.js
devServer: {
  static: [
    { directory: path.join(__dirname, 'public') },
    {
      directory: path.join(__dirname, 'node_modules/pdfjs-dist/cmaps'),
      publicPath: '/cmaps'
    }
  ]
}
```

**Production:**
Add a `.bcmap` rule to your webpack config or copy the cmaps directory to your build output.

## Development

```bash
npm install
npm run dev       # Start demo app on port 8083
npm run build     # Build demo app
npm run lib:build # Build library for publishing
```

## License

MIT
