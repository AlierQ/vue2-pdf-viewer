# vue2-pdf-viewer

[English](#english) | [中文](#中文)

---

## English

A Vue 2 PDF viewer component with annotation support, built on [pdfjs-dist](https://github.com/mozilla/pdf.js).

### Features

- **PDF Rendering** — Canvas-based, high-DPI / Retina ready
- **Page Navigation** — Previous / next page with page counter
- **Annotation Types**:

  | Annotation | Subtype | Display |
  |-----------|---------|---------|
  | Highlight | `Highlight` | Semi-transparent yellow overlay |
  | Underline | `Underline` | Red underline |
  | Strikeout | `StrikeOut` | Red strikethrough |
  | Hyperlink | `Link` | Clickable blue overlay |
  | Sticky Note | `Text` | Icon marker + click to show details |
  | Shape Highlight | `Square` / `Circle` | Colored overlay with comment label |
  | Free Text | `FreeText` | Text directly on page (with/without border) |

- **Comment Cards** — Author, date, content, and reply threads
- **Interaction Modes** — Click to toggle or hover to show annotation details
- **Custom Icon** — Replace default annotation marker with your own SVG
- **CJK Support** — CMap integration for Chinese / Japanese / Korean text

### Installation

```bash
npm install vue2-pdf-viewer
```

### Quick Start

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

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pdfUrl` | `String` | *required* | PDF URL or data URL (supports `http://`, `/path/file.pdf`, `data:application/pdf;base64,...`) |
| `annotationIcon` | `String` | `''` | Custom SVG for annotation markers. Accepts inline SVG string or `require()` path |
| `annotationMode` | `String` | `'click'` | Interaction mode: `'click'` to toggle cards, `'hover'` to show on mouseover |

### Usage Examples

**Annotation icon via require:**
```vue
<VuePdfViewer
  pdfUrl="/doc.pdf"
  :annotationIcon="require('@/assets/note.svg')"
/>
```

**Hover mode:**
```vue
<VuePdfViewer pdfUrl="/doc.pdf" annotationMode="hover" />
```

### CMap Configuration (CJK Fonts)

Chinese / Japanese / Korean text requires CMap files at `/cmaps/`.

**Dev server:**
```js
// webpack.config.js
devServer: {
  static: [
    { directory: path.join(__dirname, 'node_modules/pdfjs-dist/cmaps'), publicPath: '/cmaps' }
  ]
}
```

**Production — webpack rule (recommended):**
```js
// webpack.config.js
module: {
  rules: [{
    test: /\.bcmap$/,
    type: 'asset/resource',
    generator: { filename: 'cmaps/[name][ext]' }
  }]
}
```

### License

MIT

---

## 中文

基于 [pdfjs-dist](https://github.com/mozilla/pdf.js) 的 Vue 2 PDF 查看组件，支持批注展示。

### 功能

- **PDF 渲染** — 基于 Canvas，支持高 DPI / Retina 屏幕
- **翻页** — 上一页 / 下一页，显示页码
- **批注类型**：

  | 批注 | Subtype | 展示方式 |
  |-----|---------|---------|
  | 高亮 | `Highlight` | 黄色半透明覆盖 |
  | 下划线 | `Underline` | 红色下划线 |
  | 删除线 | `StrikeOut` | 红色删除线 |
  | 超链接 | `Link` | 蓝色可点击区域 |
  | 注解/便签 | `Text` | 图标标记 + 点击展开详情卡片 |
  | 区域高亮 | `Square` / `Circle` | 彩色覆盖 + 评论卡片 |
  | 文字/文本框 | `FreeText` | 文字直接显示在页面上 |

- **评论卡片** — 展示作者、时间、正文、回复内容
- **交互模式** — 点击切换 或 鼠标悬浮展示批注详情
- **自定义图标** — 支持传入 SVG 替换默认批注标记
- **CJK 中文支持** — 内置 CMap 配置，支持中日韩文字渲染

### 安装

```bash
npm install vue2-pdf-viewer
```

### 快速开始

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

### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pdfUrl` | `String` | *必填* | PDF 地址，支持远程 URL、本地路径、Data URL |
| `annotationIcon` | `String` | `''` | 自定义批注图标，支持 inline SVG 字符串或 `require()` 路径 |
| `annotationMode` | `String` | `'click'` | 交互模式：`'click'` 点击切换，`'hover'` 悬浮展示 |

### 使用示例

**自定义批注图标：**
```vue
<VuePdfViewer
  pdfUrl="/doc.pdf"
  :annotationIcon="require('@/assets/note.svg')"
/>
```

**悬浮模式：**
```vue
<VuePdfViewer pdfUrl="/doc.pdf" annotationMode="hover" />
```

### CMap 配置（CJK 字体支持）

中文/日文/韩文需要 CMap 文件在 `/cmaps/` 路径下可访问。

**开发环境：**
```js
// webpack.config.js
devServer: {
  static: [
    { directory: path.join(__dirname, 'node_modules/pdfjs-dist/cmaps'), publicPath: '/cmaps' }
  ]
}
```

**生产构建 — webpack 规则（推荐）：**
```js
// webpack.config.js
module: {
  rules: [{
    test: /\.bcmap$/,
    type: 'asset/resource',
    generator: { filename: 'cmaps/[name][ext]' }
  }]
}
```

### License

MIT
