<template>
  <div class="pdf-container">
    <!-- 工具栏：翻页 + 页码 -->
    <div class="pdf-toolbar">
      <button @click="prevPage" :disabled="currentPage <= 1">上一页</button>
      <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button @click="nextPage" :disabled="currentPage >= totalPages">下一页</button>
    </div>

    <!-- PDF 渲染区域（相对定位，用于叠加批注层） -->
    <div class="pdf-page-wrapper" ref="pageWrapper">
      <canvas ref="pdfCanvas"></canvas>
      <!-- 批注层：与 canvas 完全重叠 -->
      <div class="annotation-layer" ref="annotationLayer"></div>
    </div>
  </div>
</template>

<script>
import * as pdfjsLib from 'pdfjs-dist/es5/build/pdf';
import pdfWorker from 'pdfjs-dist/es5/build/pdf.worker.entry';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default {
  name: 'PdfViewer',
  props: {
    pdfUrl: {
      type: String,
      required: true
    },
    // 自定义批注图标，支持 SVG 字符串、require() 引入的路径、或 Module 对象
    annotationIcon: {
      default: ''
    },
    // 批注交互模式: 'click' 点击切换 / 'hover' 悬浮展示
    annotationMode: {
      type: String,
      default: 'click',
      validator: v => ['click', 'hover'].includes(v)
    }
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
    // ---------- PDF 加载 ----------
    async loadPdf(url) {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: url,
          cMapUrl: '/cmaps/',
          cMapPacked: true
        });
        this.pdfDoc = await loadingTask.promise;
        this.totalPages = this.pdfDoc.numPages;
        await this.renderPage(this.currentPage);
      } catch (error) {
        console.error('PDF 加载失败:', error);
      }
    },

    // ---------- 页面渲染（含批注）----------
    async renderPage(num) {
      if (!this.pdfDoc) return;

      this.pageRendering = true;
      const page = await this.pdfDoc.getPage(num);
      const dpr = window.devicePixelRatio || 1;

      // 所有页面使用相同的 cssScale，保证大小一致
      const cssViewport = page.getViewport({ scale: this.scale });
      const deviceViewport = page.getViewport({ scale: this.scale * dpr });

      const canvas = this.$refs.pdfCanvas;
      const context = canvas.getContext('2d');

      // 绘制缓冲区 = 物理像素（高清）
      canvas.width = Math.floor(deviceViewport.width);
      canvas.height = Math.floor(deviceViewport.height);

      // CSS 显示尺寸 = 逻辑像素
      canvas.style.width = Math.floor(cssViewport.width) + 'px';
      canvas.style.height = Math.floor(cssViewport.height) + 'px';

      // 批注层尺寸与 canvas CSS 尺寸一致
      const annLayer = this.$refs.annotationLayer;
      if (annLayer) {
        annLayer.style.width = canvas.style.width;
        annLayer.style.height = canvas.style.height;
        // 动态元素需要 inline pointer-events（scoped CSS 无法覆盖）
        annLayer.style.pointerEvents = 'none';
      }

      // 以物理像素 viewport 渲染
      const renderTask = page.render({
        canvasContext: context,
        viewport: deviceViewport
      });

      const annotationsPromise = page.getAnnotations();
      await renderTask.promise;

      const annotations = await annotationsPromise;
      this.renderAnnotations(annotations, cssViewport, page);

      this.pageRendering = false;

      if (this.pageNumPending !== null) {
        const pending = this.pageNumPending;
        this.pageNumPending = null;
        this.renderPage(pending);
      }
    },

    // ---------- 批注绘制 ----------
    renderAnnotations(annotations, viewport, page) {
      const layer = this.$refs.annotationLayer;
      if (!layer) return;

      layer.innerHTML = '';

      // 收集有内容的回复批注，按父批注 ID 分组
      const replyMap = {}
      annotations.forEach(a => {
        if (a.subtype === 'Text' && a.inReplyTo && a.contents) {
          if (!replyMap[a.inReplyTo]) replyMap[a.inReplyTo] = []
          replyMap[a.inReplyTo].push(a)
        }
      })

      annotations.forEach(annotation => {
        if (!annotation.rect) return;

        const rect = this.convertPdfRectToScreen(annotation.rect, viewport);
        const replies = replyMap[annotation.id] || []
        const element = this.createAnnotationElement(annotation, rect, viewport, replies);
        if (element) {
          layer.appendChild(element);
        }
      });
    },

    // 坐标转换：PDF 矩形 -> 屏幕像素矩形
    convertPdfRectToScreen(pdfRect, viewport) {
      const [x1, y1, x2, y2] = pdfRect;
      const transform = viewport.transform;

      const xa = transform[0], xb = transform[1], xc = transform[2],
        xd = transform[3], xe = transform[4], yf = transform[5];

      const leftTopX = xa * x1 + xc * y2 + xe;
      const leftTopY = xb * x1 + xd * y2 + yf;

      const rightBottomX = xa * x2 + xc * y1 + xe;
      const rightBottomY = xb * x2 + xd * y1 + yf;

      return {
        left: Math.min(leftTopX, rightBottomX),
        top: Math.min(leftTopY, rightBottomY),
        width: Math.abs(leftTopX - rightBottomX),
        height: Math.abs(leftTopY - rightBottomY)
      };
    },

    // 创建批注对应的 DOM 元素
    createAnnotationElement(annotation, rect, viewport, replies = []) {
      const div = document.createElement('div');
      div.className = 'annotation-item';
      div.style.position = 'absolute';
      div.style.left = rect.left + 'px';
      div.style.top = rect.top + 'px';
      div.style.width = rect.width + 'px';
      div.style.height = rect.height + 'px';

      switch (annotation.subtype) {
        case 'Link':
          div.className += ' annotation-link';
          div.style.cursor = 'pointer';
          div.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
          div.title = annotation.url || annotation.dest || '链接';
          div.addEventListener('click', () => {
            if (annotation.url) {
              window.open(annotation.url, '_blank');
            } else if (annotation.dest) {
              console.log('内部跳转目标:', annotation.dest);
            }
          });
          break;

        case 'Highlight':
          div.className += ' annotation-highlight';
          div.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
          break;

        case 'Underline':
          div.className += ' annotation-underline';
          div.style.borderBottom = '2px solid red';
          break;

        case 'StrikeOut':
          div.className += ' annotation-strikeout';
          div.style.textDecoration = 'line-through';
          div.style.textDecorationColor = 'red';
          break;

        case 'Text':
          // 注解：图标 + 点击展开标签。跳过回复批注和空内容
          if (annotation.inReplyTo || !annotation.contents) return null

          div.className += ' annotation-text';
          div.style.cursor = 'pointer';
          div.style.pointerEvents = 'auto';
          {
            const icon = this.resolveAnnotationIcon();
            if (icon) {
              div.style.background = 'none';
              div.style.display = 'flex';
              div.style.alignItems = 'flex-start';
              div.style.overflow = 'visible';
              const wrapper = document.createElement('span');
              wrapper.style.display = 'inline-block';
              wrapper.style.width = '59px';
              wrapper.style.height = '59px';
              wrapper.style.flexShrink = '0';
              wrapper.style.cursor = 'pointer';
              wrapper.style.pointerEvents = 'auto';

              if (icon.startsWith('<')) {
                wrapper.innerHTML = icon;
                const svg = wrapper.querySelector('svg');
                if (svg) {
                  svg.style.width = '100%';
                  svg.style.height = '100%';
                  svg.style.display = 'block';
                }
              } else {
                const img = document.createElement('img');
                img.src = icon;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                wrapper.appendChild(img);
              }
              div.appendChild(wrapper);
            } else {
              div.style.backgroundColor = 'rgba(255, 200, 0, 0.4)';
            }
          }

          // 创建标签（默认隐藏），交互模式由 annotationMode prop 控制
          {
            const label = this.createAnnotationLabel(annotation, rect, viewport.width, replies);
            label.style.display = 'none';
            div.appendChild(label);
            this.bindAnnotationInteraction(div, label);
          }
          break

        case 'FreeText':
          // hasAppearance 为 true 时，PDF.js 已将文字渲染到 canvas，无需覆盖层
          if (!annotation.contents || annotation.hasAppearance) return null

          div.className += ' annotation-freetext';
          div.style.pointerEvents = 'auto';
          div.style.overflow = 'hidden';
          div.style.padding = '2px 4px';
          div.style.fontSize = '12px';
          div.style.lineHeight = '1.3';
          div.style.color = '#333';
          div.style.whiteSpace = 'pre-wrap';
          div.style.wordBreak = 'break-word';
          div.textContent = annotation.contents

          if (annotation.borderStyle && annotation.borderStyle.width > 0) {
            div.style.border = '1px solid #999'
            div.style.backgroundColor = '#fff'
          }
          break

        case 'Square':
        case 'Circle':
          div.className += ' annotation-shape';
          div.style.pointerEvents = 'auto';
          // hasAppearance 为 true 时 canvas 已有色块，overlay 仅负责点击交互，不加背景色
          if (!annotation.hasAppearance) {
            if (annotation.color) {
              const c = annotation.color
              div.style.backgroundColor = `rgba(${c[0] || c['0']}, ${c[1] || c['1']}, ${c[2] || c['2']}, 0.3)`
            } else {
              div.style.backgroundColor = 'rgba(255, 255, 0, 0.25)'
            }
          }
          if (annotation.subtype === 'Circle') {
            div.style.borderRadius = '50%'
          }
          if (annotation.contents) {
            div.style.cursor = 'pointer'
            const label = this.createAnnotationLabel(annotation, rect, viewport.width, replies)
            label.style.display = 'none'
            div.appendChild(label)
            this.bindAnnotationInteraction(div, label)
          }
          break

        default:
          // Popup, Stamp, Line, Square, Circle, Ink, Caret, Widget 等不展示
          return null;
      }

      return div;
    },

    // 归一化 annotationIcon：处理 Module 对象或纯字符串
    resolveAnnotationIcon() {
      const raw = this.annotationIcon;
      if (!raw) return '';
      if (typeof raw === 'string') return raw;
      // webpack 5 file-loader 的 esModule 模式：{ default: 'url' }
      if (raw && typeof raw === 'object' && raw.default) return raw.default;
      return String(raw);
    },

    // 为批注添加可见文本标签
    // 绑定批注交互：click 模式点击切换，hover 模式悬浮展示
    bindAnnotationInteraction(triggerEl, labelEl) {
      if (this.annotationMode === 'hover') {
        triggerEl.addEventListener('mouseenter', () => { labelEl.style.display = '' })
        triggerEl.addEventListener('mouseleave', () => { labelEl.style.display = 'none' })
        labelEl.addEventListener('mouseenter', () => { labelEl.style.display = '' })
        labelEl.addEventListener('mouseleave', () => { labelEl.style.display = 'none' })
      } else {
        triggerEl.addEventListener('click', (e) => {
          e.stopPropagation()
          labelEl.style.display = labelEl.style.display === 'none' ? '' : 'none'
        })
      }
      // 点击标签本身始终关闭
      labelEl.addEventListener('click', (e) => {
        e.stopPropagation()
        labelEl.style.display = 'none'
      })
    },

    // 创建批注文本卡片（返回 DOM 元素，由调用方决定显隐和挂载）
    createAnnotationLabel(annotation, rect, pageWidth, replies = []) {
      const author = annotation.title || '';
      const dateStr = this.formatAnnotationDate(annotation.date || annotation.modificationDate);
      const content = annotation.contents || '';

      const card = document.createElement('div');
      card.className = 'annotation-label';
      const cardApproxWidth = 380;
      const isWide = rect.width > 200;
      const isNearRightEdge = !isWide && pageWidth && (rect.left + rect.width + cardApproxWidth > pageWidth);

      // 定位策略：
      // - 宽标注(>200px)：右下角，箭头在上方向下指
      // - 窄标注靠近右边缘：左侧，箭头右边指向左
      // - 窄标注默认：右侧，箭头左边指向右
      let arrowSide = 'left'; // left | right | top
      card.style.position = 'absolute';
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
        arrowSide = 'left';
      }
      card.style.width = 'fit-content';
      card.style.maxWidth = '770px';
      card.style.minWidth = '400px';
      card.style.zIndex = '2';
      card.style.pointerEvents = 'auto';
      card.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif';
      card.style.borderRadius = '10px';
      card.style.textAlign = 'left';
      card.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)';
      card.style.overflow = 'hidden';
      card.style.fontSize = '23px';

      // 头部：作者 + 时间
      if (author || dateStr) {
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'baseline';
        header.style.justifyContent = 'space-between';
        header.style.flexWrap = 'wrap';
        header.style.gap = '4px 16px';
        header.style.padding = '22px 26px';
        header.style.background = '#f8f6e9';
        header.style.borderBottom = '1px solid #e8e0c0';

        if (author) {
          const authorEl = document.createElement('span');
          authorEl.style.fontWeight = '600';
          authorEl.style.color = '#5c4a1f';
          authorEl.style.fontSize = '22px';
          authorEl.style.wordBreak = 'break-word';
          authorEl.textContent = author;
          header.appendChild(authorEl);
        }

        if (dateStr) {
          const dateEl = document.createElement('span');
          dateEl.style.color = '#999';
          dateEl.style.fontSize = '20px';
          dateEl.style.whiteSpace = 'nowrap';
          dateEl.textContent = dateStr;
          header.appendChild(dateEl);
        }

        card.appendChild(header);
      }

      // 正文
      if (content) {
        const body = document.createElement('div');
        body.style.padding = '24px 26px';
        body.style.lineHeight = '1.9';
        body.style.color = '#333';
        body.style.whiteSpace = 'pre-wrap';
        body.style.wordBreak = 'break-word';
        body.style.background = '#fffef9';
        body.style.fontSize = '23px';
        body.textContent = content;
        card.appendChild(body);
      }

      // 回复内容
      if (replies.length > 0) {
        replies.forEach(reply => {
          const replySection = document.createElement('div')
          replySection.style.borderTop = '1px solid #eee'
          replySection.style.marginTop = '1px solid #eee'

          // 回复头部：作者 + 日期
          const replyHeader = document.createElement('div')
          replyHeader.style.display = 'flex'
          replyHeader.style.alignItems = 'baseline'
          replyHeader.style.justifyContent = 'space-between'
          replyHeader.style.gap = '8px'
          replyHeader.style.padding = '20px 26px 10px 26px'
          replyHeader.style.background = '#fafaf5'

          const replyAuthor = document.createElement('span')
          replyAuthor.style.fontWeight = '600'
          replyAuthor.style.fontSize = '18px'
          replyAuthor.style.color = '#8a6d3b'
          replyAuthor.textContent = (reply.title || '未知') + ' 回复'
          replyHeader.appendChild(replyAuthor)

          const replyDate = this.formatAnnotationDate(reply.date || reply.modificationDate)
          if (replyDate) {
            const dateEl = document.createElement('span')
            dateEl.style.color = '#999'
            dateEl.style.fontSize = '16px'
            dateEl.style.whiteSpace = 'nowrap'
            dateEl.textContent = replyDate
            replyHeader.appendChild(dateEl)
          }
          replySection.appendChild(replyHeader)

          // 回复正文
          const replyBody = document.createElement('div')
          replyBody.style.padding = '10px 26px'
          replyBody.style.fontSize = '21px'
          replyBody.style.color = '#555'
          replyBody.style.whiteSpace = 'pre-wrap'
          replyBody.style.wordBreak = 'break-word'
          replyBody.style.lineHeight = '1.7'
          replyBody.style.background = '#fafaf5'
          replyBody.textContent = reply.contents
          replySection.appendChild(replyBody)

          card.appendChild(replySection)
        })
      }

      // 小三角箭头，指向批注标记
      const arrow = document.createElement('div');
      arrow.style.position = 'absolute';
      arrow.style.width = '0';
      arrow.style.height = '0';
      if (arrowSide === 'top') {
        // 箭头在上方，向下指向标注
        arrow.style.top = '-6px';
        arrow.style.right = '12px';
        arrow.style.borderLeft = '6px solid transparent';
        arrow.style.borderRight = '6px solid transparent';
        arrow.style.borderBottom = '6px solid #f8f6e9';
      } else if (arrowSide === 'right') {
        // 箭头在右侧，指向左边
        arrow.style.top = '10px';
        arrow.style.right = '-6px';
        arrow.style.borderTop = '6px solid transparent';
        arrow.style.borderBottom = '6px solid transparent';
        arrow.style.borderLeft = '6px solid #f8f6e9';
      } else {
        // 箭头在左侧，指向右边
        arrow.style.top = '10px';
        arrow.style.left = '-6px';
        arrow.style.borderTop = '6px solid transparent';
        arrow.style.borderBottom = '6px solid transparent';
        arrow.style.borderRight = '6px solid #f8f6e9';
      }
      card.appendChild(arrow);

      return card;
    },

    // 格式化 PDF 批注日期
    formatAnnotationDate(raw) {
      if (!raw) return '';
      try {
        // PDF 日期格式: "D:20230515120000+08'00'" 或类似
        const match = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
        if (match) {
          const [, y, m, d, h, mi, s] = match;
          return `${y}-${m}-${d} ${h}:${mi}`;
        }
        // 尝试直接解析 ISO
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          return d.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (e) { /* ignore */ }
      return '';
    },

    // ---------- 翻页控制 ----------
    prevPage() {
      if (this.currentPage <= 1) return;
      this.currentPage--;
      this.queueRenderPage(this.currentPage);
    },
    nextPage() {
      if (this.currentPage >= this.totalPages) return;
      this.currentPage++;
      this.queueRenderPage(this.currentPage);
    },

    queueRenderPage(num) {
      if (this.pageRendering) {
        this.pageNumPending = num;
      } else {
        this.renderPage(num);
      }
    }
  },

  mounted() {
    this.loadPdf(this.pdfUrl);
  }
};
</script>

<style scoped>
.pdf-container {
  border: 1px solid #ccc;
  display: block;
  width: 100%;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #f0f0f0;
  border-bottom: 1px solid #ccc;
}

.pdf-toolbar button {
  padding: 4px 12px;
  cursor: pointer;
}

.pdf-toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pdf-page-wrapper {
  position: relative;
  line-height: 0;
}

canvas {
  display: block;
}

.annotation-layer {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
}

.annotation-layer .annotation-link,
.annotation-layer .annotation-text,
.annotation-layer .annotation-shape {
  pointer-events: auto;
}
</style>
