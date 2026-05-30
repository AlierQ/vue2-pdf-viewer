<template>
  <div class="pdf-container">
    <div class="pdf-toolbar">
      <button @click="prevPage" :disabled="currentPage <= 1">上一页</button>
      <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button @click="nextPage" :disabled="currentPage >= totalPages">下一页</button>
    </div>
    <div class="pdf-page-wrapper" ref="pageWrapper">
      <canvas ref="pdfCanvas"></canvas>
      <div class="annotation-layer" ref="annotationLayer"></div>
    </div>
  </div>
</template>

<script>
import * as pdfjsLib from 'pdfjs-dist/es5/build/pdf';
import pdfWorker from 'pdfjs-dist/es5/build/pdf.worker.entry';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const CSS = {
  // 批注标签卡片
  LABEL: 'v2pv-label',
  LABEL_HDR: 'v2pv-label-hdr',
  LABEL_AUTHOR: 'v2pv-label-author',
  LABEL_DATE: 'v2pv-label-date',
  LABEL_BODY: 'v2pv-label-body',
  // 回复
  REPLY: 'v2pv-reply',
  REPLY_HDR: 'v2pv-reply-hdr',
  REPLY_AUTHOR: 'v2pv-reply-author',
  REPLY_DATE: 'v2pv-reply-date',
  REPLY_BODY: 'v2pv-reply-body',
  // 箭头
  ARROW: 'v2pv-arrow',
  // FreeText
  FREETEXT: 'v2pv-freetext',
  FREETEXT_BOX: 'v2pv-freetext-box',
  // 图标
  ICON: 'v2pv-icon',
  ICON_IMG: 'v2pv-icon-img',
  // 批注项
  ITEM: 'v2pv-item',
  ITEM_LINK: 'v2pv-item-link',
  ITEM_HIGHLIGHT: 'v2pv-item-highlight',
  ITEM_UNDERLINE: 'v2pv-item-underline',
  ITEM_STRIKEOUT: 'v2pv-item-strikeout',
  ITEM_TEXT: 'v2pv-item-text',
  ITEM_SHAPE: 'v2pv-item-shape',
};

export default {
  name: 'PdfViewer',
  props: {
    pdfUrl: { type: String, required: true },
    annotationIcon: { default: '' },
    annotationMode: { type: String, default: 'click', validator: v => ['click', 'hover'].includes(v) }
  },
  data() {
    return {
      pdfDoc: null,
      currentPage: 1,
      totalPages: 0,
      pageRendering: false,
      pageNumPending: null,
      scale: 3
    };
  },
  methods: {
    async loadPdf(url) {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: url, cMapUrl: '/cmaps/', cMapPacked: true });
        this.pdfDoc = await loadingTask.promise;
        this.totalPages = this.pdfDoc.numPages;
        await this.renderPage(this.currentPage);
      } catch (error) {
        console.error('PDF 加载失败:', error);
      }
    },

    async renderPage(num) {
      if (!this.pdfDoc) return;
      this.pageRendering = true;
      const page = await this.pdfDoc.getPage(num);
      const dpr = window.devicePixelRatio || 1;

      const cssViewport = page.getViewport({ scale: this.scale });
      const deviceViewport = page.getViewport({ scale: this.scale * dpr });

      const canvas = this.$refs.pdfCanvas;
      const ctx = canvas.getContext('2d');
      canvas.width = Math.floor(deviceViewport.width);
      canvas.height = Math.floor(deviceViewport.height);
      canvas.style.width = Math.floor(cssViewport.width) + 'px';
      canvas.style.height = Math.floor(cssViewport.height) + 'px';

      const annLayer = this.$refs.annotationLayer;
      if (annLayer) {
        annLayer.style.width = canvas.style.width;
        annLayer.style.height = canvas.style.height;
        annLayer.style.pointerEvents = 'none';
      }

      const renderTask = page.render({ canvasContext: ctx, viewport: deviceViewport });
      const annotationsPromise = page.getAnnotations();
      await renderTask.promise;
      this.renderAnnotations(await annotationsPromise, cssViewport);
      this.pageRendering = false;

      if (this.pageNumPending !== null) {
        const pending = this.pageNumPending;
        this.pageNumPending = null;
        this.renderPage(pending);
      }
    },

    renderAnnotations(annotations, viewport) {
      const layer = this.$refs.annotationLayer;
      if (!layer) return;
      layer.innerHTML = '';

      const replyMap = {};
      annotations.forEach(a => {
        if (a.subtype === 'Text' && a.inReplyTo && a.contents) {
          if (!replyMap[a.inReplyTo]) replyMap[a.inReplyTo] = [];
          replyMap[a.inReplyTo].push(a);
        }
      });

      annotations.forEach(annotation => {
        if (!annotation.rect) return;
        const rect = this.convertPdfRectToScreen(annotation.rect, viewport);
        const element = this.createAnnotationElement(annotation, rect, viewport, replyMap[annotation.id] || []);
        if (element) layer.appendChild(element);
      });
    },

    convertPdfRectToScreen(pdfRect, viewport) {
      const [x1, y1, x2, y2] = pdfRect;
      const t = viewport.transform;
      const ltX = t[0] * x1 + t[2] * y2 + t[4];
      const ltY = t[1] * x1 + t[3] * y2 + t[5];
      const rbX = t[0] * x2 + t[2] * y1 + t[4];
      const rbY = t[1] * x2 + t[3] * y1 + t[5];
      return {
        left: Math.min(ltX, rbX),
        top: Math.min(ltY, rbY),
        width: Math.abs(ltX - rbX),
        height: Math.abs(ltY - rbY)
      };
    },

    createAnnotationElement(annotation, rect, viewport, replies) {
      const div = document.createElement('div');
      div.className = CSS.ITEM;
      div.style.left = rect.left + 'px';
      div.style.top = rect.top + 'px';
      div.style.width = rect.width + 'px';
      div.style.height = rect.height + 'px';

      switch (annotation.subtype) {
        case 'Link':
          div.className += ' ' + CSS.ITEM_LINK;
          div.title = annotation.url || annotation.dest || '';
          div.addEventListener('click', () => {
            if (annotation.url) window.open(annotation.url, '_blank');
          });
          break;

        case 'Highlight':
          div.className += ' ' + CSS.ITEM_HIGHLIGHT;
          break;

        case 'Underline':
          div.className += ' ' + CSS.ITEM_UNDERLINE;
          break;

        case 'StrikeOut':
          div.className += ' ' + CSS.ITEM_STRIKEOUT;
          break;

        case 'Text':
          if (annotation.inReplyTo || !annotation.contents) return null;
          div.className += ' ' + CSS.ITEM_TEXT;
          {
            const icon = this.resolveAnnotationIcon();
            if (icon) {
              div.style.background = 'none';
              div.style.display = 'flex';
              div.style.alignItems = 'flex-start';
              div.style.overflow = 'visible';
              const wrapper = document.createElement('span');
              wrapper.className = CSS.ICON;
              if (icon.startsWith('<')) {
                wrapper.innerHTML = icon;
                const svg = wrapper.querySelector('svg');
                if (svg) svg.className = CSS.ICON_IMG;
              } else {
                const img = document.createElement('img');
                img.src = icon;
                img.className = CSS.ICON_IMG;
                wrapper.appendChild(img);
              }
              div.appendChild(wrapper);
            } else {
              div.style.backgroundColor = 'rgba(255, 200, 0, 0.4)';
            }
          }
          {
            const label = this.createAnnotationLabel(annotation, rect, viewport.width, replies);
            label.style.display = 'none';
            div.appendChild(label);
            this.bindAnnotationInteraction(div, label);
          }
          break;

        case 'FreeText':
          if (!annotation.contents || annotation.hasAppearance) return null;
          div.className += ' ' + CSS.FREETEXT;
          if (annotation.borderStyle && annotation.borderStyle.width > 0) {
            div.className += ' ' + CSS.FREETEXT_BOX;
          }
          div.textContent = annotation.contents;
          break;

        case 'Square':
        case 'Circle':
          div.className += ' ' + CSS.ITEM_SHAPE;
          if (!annotation.hasAppearance && annotation.color) {
            const c = annotation.color;
            div.style.backgroundColor = `rgba(${c[0] || c['0']}, ${c[1] || c['1']}, ${c[2] || c['2']}, 0.3)`;
          }
          if (annotation.subtype === 'Circle') div.style.borderRadius = '50%';
          if (annotation.contents) {
            const label = this.createAnnotationLabel(annotation, rect, viewport.width, replies);
            label.style.display = 'none';
            div.appendChild(label);
            this.bindAnnotationInteraction(div, label);
          }
          break;

        default:
          return null;
      }
      return div;
    },

    resolveAnnotationIcon() {
      const raw = this.annotationIcon;
      if (!raw) return '';
      if (typeof raw === 'string') return raw;
      if (raw && typeof raw === 'object' && raw.default) return raw.default;
      return String(raw);
    },

    bindAnnotationInteraction(triggerEl, labelEl) {
      if (this.annotationMode === 'hover') {
        triggerEl.addEventListener('mouseenter', () => { labelEl.style.display = ''; });
        triggerEl.addEventListener('mouseleave', () => { labelEl.style.display = 'none'; });
        labelEl.addEventListener('mouseenter', () => { labelEl.style.display = ''; });
        labelEl.addEventListener('mouseleave', () => { labelEl.style.display = 'none'; });
      } else {
        triggerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          labelEl.style.display = labelEl.style.display === 'none' ? '' : 'none';
        });
      }
      labelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        labelEl.style.display = 'none';
      });
    },

    createAnnotationLabel(annotation, rect, pageWidth, replies) {
      const author = annotation.title || '';
      const dateStr = this.formatAnnotationDate(annotation.date || annotation.modificationDate);
      const content = annotation.contents || '';

      const card = document.createElement('div');
      card.className = CSS.LABEL;
      const isWide = rect.width > 200;
      const isNearRightEdge = !isWide && pageWidth && (rect.left + rect.width + 380 > pageWidth);
      let arrowSide = 'left';

      if (isWide) {
        card.style.left = 'auto';
        card.style.right = '0px';
        card.style.top = (rect.height + 8) + 'px';
        arrowSide = 'top';
      } else if (isNearRightEdge) {
        card.style.right = (rect.width + 8) + 'px';
        card.style.left = 'auto';
        card.style.top = '0px';
        arrowSide = 'right';
      } else {
        card.style.left = (rect.width + 8) + 'px';
        card.style.top = '0px';
      }

      // 头部
      if (author || dateStr) {
        const header = document.createElement('div');
        header.className = CSS.LABEL_HDR;
        if (author) {
          const el = document.createElement('span');
          el.className = CSS.LABEL_AUTHOR;
          el.textContent = author;
          header.appendChild(el);
        }
        if (dateStr) {
          const el = document.createElement('span');
          el.className = CSS.LABEL_DATE;
          el.textContent = dateStr;
          header.appendChild(el);
        }
        card.appendChild(header);
      }

      // 正文
      if (content) {
        const body = document.createElement('div');
        body.className = CSS.LABEL_BODY;
        body.textContent = content;
        card.appendChild(body);
      }

      // 回复
      replies.forEach(reply => {
        const section = document.createElement('div');
        section.className = CSS.REPLY;

        const replyHeader = document.createElement('div');
        replyHeader.className = CSS.REPLY_HDR;
        const authorEl = document.createElement('span');
        authorEl.className = CSS.REPLY_AUTHOR;
        authorEl.textContent = (reply.title || '未知') + ' 回复';
        replyHeader.appendChild(authorEl);
        const replyDate = this.formatAnnotationDate(reply.date || reply.modificationDate);
        if (replyDate) {
          const dateEl = document.createElement('span');
          dateEl.className = CSS.REPLY_DATE;
          dateEl.textContent = replyDate;
          replyHeader.appendChild(dateEl);
        }
        section.appendChild(replyHeader);

        const replyBody = document.createElement('div');
        replyBody.className = CSS.REPLY_BODY;
        replyBody.textContent = reply.contents;
        section.appendChild(replyBody);
        card.appendChild(section);
      });

      // 箭头
      const arrow = document.createElement('div');
      arrow.className = CSS.ARROW;
      if (arrowSide === 'top') {
        arrow.style.top = '-6px';
        arrow.style.right = '12px';
        arrow.style.borderRight = arrow.style.borderLeft = '6px solid transparent';
        arrow.style.borderBottom = '6px solid #f8f6e9';
      } else if (arrowSide === 'right') {
        arrow.style.top = '10px';
        arrow.style.right = '-6px';
        arrow.style.borderTop = arrow.style.borderBottom = '6px solid transparent';
        arrow.style.borderLeft = '6px solid #f8f6e9';
      } else {
        arrow.style.top = '10px';
        arrow.style.left = '-6px';
        arrow.style.borderTop = arrow.style.borderBottom = '6px solid transparent';
        arrow.style.borderRight = '6px solid #f8f6e9';
      }
      card.appendChild(arrow);

      return card;
    },

    formatAnnotationDate(raw) {
      if (!raw) return '';
      try {
        const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch (e) { /* ignore */ }
      return '';
    },

    prevPage() { if (this.currentPage > 1) { this.currentPage--; this.queueRenderPage(this.currentPage); } },
    nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.queueRenderPage(this.currentPage); } },
    queueRenderPage(num) {
      if (this.pageRendering) { this.pageNumPending = num; } else { this.renderPage(num); }
    }
  },
  mounted() { this.loadPdf(this.pdfUrl); }
};
</script>

<!-- 非 scoped: 动态 DOM 元素匹配 -->
<style>
/* ===== 批注标签卡片 ===== */
.v2pv-label {
  position: absolute;
  width: fit-content;
  max-width: 770px;
  min-width: 400px;
  z-index: 2;
  pointer-events: auto;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  border-radius: 10px;
  text-align: left;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
  overflow: hidden;
  font-size: 23px;
}
.v2pv-label-hdr {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 22px 26px;
  background: #f8f6e9;
  border-bottom: 1px solid #e8e0c0;
}
.v2pv-label-author {
  font-weight: 600;
  color: #5c4a1f;
  font-size: 22px;
  word-break: break-word;
}
.v2pv-label-date {
  color: #999;
  font-size: 20px;
  white-space: nowrap;
}
.v2pv-label-body {
  padding: 24px 26px;
  line-height: 1.9;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fffef9;
  font-size: 23px;
}

/* ===== 回复区域 ===== */
.v2pv-reply {
  border-top: 1px solid #eee;
}
.v2pv-reply-hdr {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 20px 26px 10px 26px;
  background: #fafaf5;
}
.v2pv-reply-author {
  font-weight: 600;
  font-size: 18px;
  color: #8a6d3b;
}
.v2pv-reply-date {
  color: #999;
  font-size: 16px;
  white-space: nowrap;
}
.v2pv-reply-body {
  padding: 10px 26px;
  font-size: 21px;
  color: #555;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  background: #fafaf5;
}

/* ===== 箭头 ===== */
.v2pv-arrow {
  position: absolute;
  width: 0;
  height: 0;
}

/* ===== 批注标记项 ===== */
.v2pv-item {
  position: absolute;
  pointer-events: auto;
}
.v2pv-item-link {
  cursor: pointer;
  background: rgba(0, 0, 255, 0.1);
}
.v2pv-item-highlight {
  background: rgba(255, 255, 0, 0.4);
}
.v2pv-item-underline {
  border-bottom: 2px solid red;
}
.v2pv-item-strikeout {
  text-decoration: line-through;
  text-decoration-color: red;
}
.v2pv-item-text {
  cursor: pointer;
}
.v2pv-item-shape {
  cursor: pointer;
}

/* ===== 图标 ===== */
.v2pv-icon {
  display: inline-block;
  width: 59px;
  height: 59px;
  flex-shrink: 0;
  cursor: pointer;
}
.v2pv-icon-img {
  width: 100%;
  height: 100%;
  display: block;
}

/* ===== FreeText ===== */
.v2pv-freetext {
  overflow: hidden;
  padding: 2px 4px;
  font-size: 12px;
  line-height: 1.3;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}
.v2pv-freetext-box {
  border: 1px solid #999;
  background: #fff;
}
</style>

<style scoped>
.pdf-container { border: 1px solid #ccc; display: block; width: 100%; }
.pdf-toolbar { display: flex; align-items: center; gap: 10px; padding: 8px; background: #f0f0f0; border-bottom: 1px solid #ccc; }
.pdf-toolbar button { padding: 4px 12px; cursor: pointer; }
.pdf-toolbar button:disabled { cursor: not-allowed; opacity: 0.5; }
.pdf-page-wrapper { position: relative; line-height: 0; }
canvas { display: block; }
.annotation-layer { position: absolute; top: 0; left: 0; overflow: hidden; }
</style>
