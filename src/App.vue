<template>
  <div id="app">
    <h1>{{ msg }}</h1>
    <p>This is a Vue 2 project with PDF support using vue2-pdf-viewer</p>

    <!-- PDF查看器 -->
    <div v-if="pdfUrl" style="border: 1px solid #ccc; padding: 20px; margin: 20px auto; width: 95%;">
      <h3>PDF Viewer:</h3>
      <VuePdfViewer :pdfUrl="pdfUrl" :annotationIcon="annotationIcon" />
    </div>

    <div v-else>
      <p>Please select a PDF file to view it here.</p>
    </div>

    <div style="margin-top: 20px;">
      <label>Select a PDF file to view:</label>
      <input type="file" accept=".pdf" @change="handleFileUpload" />
    </div>
  </div>
</template>
<script>
import VuePdfViewer from '@/components/VuePdfViewer.vue'


export default {
  name: 'App',
  components: {
    VuePdfViewer
  },
  data() {
    return {
      msg: 'Vue2 PDF Viewer Demo',
      pdfUrl: null,
      annotationIcon: require('@/assets/annotation-noicon.svg'),
    }
  },
  methods: {
    handleFileUpload(event) {
      const that = this
      const file = event.target.files[0];
      if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.pdfUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    },
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>