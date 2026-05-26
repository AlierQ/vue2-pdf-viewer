const path = require('path')
const VueLoaderPlugin = require('vue-loader/lib/plugin')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'vue2-pdf-viewer.common.js',
    library: {
      name: 'Vue2PdfViewer',
      type: 'umd',
      export: 'default'
    },
    globalObject: 'this'
  },
  resolve: {
    extensions: ['.js', '.vue'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
      '@': path.resolve(__dirname, 'src')
    }
  },
  externals: {
    vue: {
      commonjs: 'vue',
      commonjs2: 'vue',
      amd: 'vue',
      root: 'Vue'
    },
    'pdfjs-dist/es5/build/pdf': {
      commonjs: 'pdfjs-dist/es5/build/pdf',
      commonjs2: 'pdfjs-dist/es5/build/pdf',
      amd: 'pdfjs-dist/es5/build/pdf',
      root: 'pdfjsLib'
    },
    'pdfjs-dist/es5/build/pdf.worker.entry': {
      commonjs: 'pdfjs-dist/es5/build/pdf.worker.entry',
      commonjs2: 'pdfjs-dist/es5/build/pdf.worker.entry'
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin()
  ]
}
