const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

module.exports = {
  mode: 'development', // 添加mode配置解决警告
  devtool: 'eval-source-map', // 添加此行以支持更好的调试体验
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: '/'
  },
  resolve: {
    extensions: ['.js', '.vue'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
      'vue-loader$': 'vue-loader/lib/index.js',
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.bcmap$/,
        type: 'asset/resource',
        generator: {
          filename: 'cmaps/[name][ext]'
        }
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[hash:7].[ext]',
              outputPath: 'assets/',
              publicPath: 'assets/',
              esModule: false
            }
          }
        ]
      },
      {
        test: /\.(pdf)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[hash:7].[ext]',
              outputPath: 'assets/',
              publicPath: 'assets/'
            }
          }
        ]
      },
      {
        test: /\.(png|jpe?g|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[hash:7].[ext]',
              outputPath: 'assets/',
              publicPath: 'assets/'
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html'
    }),
    // 内联插件：生产构建时自动复制 CMap 文件，无需额外依赖
    {
      apply(compiler) {
        compiler.hooks.afterEmit.tapPromise('CopyCmapsPlugin', async () => {
          const fs = require('fs');
          const srcDir = path.join(__dirname, 'node_modules/pdfjs-dist/cmaps');
          const destDir = path.join(__dirname, 'dist/cmaps');
          try {
            if (!fs.existsSync(srcDir)) return;
            await fs.promises.cp(srcDir, destDir, { recursive: true });
          } catch (e) {
            console.warn('CMap 文件复制失败，中文可能无法渲染:', e.message);
          }
        });
      }
    }
  ],
  devServer: {
    static: [
      // dev 模式直接从 node_modules 提供 CMap 文件，无需拷贝
      { directory: path.join(__dirname, 'node_modules/pdfjs-dist/cmaps'), publicPath: '/cmaps' }
    ],
    port: 8083,
    hot: true,
    open: true
  }
};