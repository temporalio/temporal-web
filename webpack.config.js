const path = require('path'),
  webpack = require('webpack'),
  ExtractTextPlugin = require('extract-text-webpack-plugin'),
  HtmlWebpackPlugin = require('html-webpack-plugin'),
  extractStylus = 'css-loader?sourceMap!stylus-loader',
  development = !['production', 'ci'].includes(process.env.NODE_ENV);

require('babel-polyfill');

const PUBLIC_PATH = process.env.TEMPORAL_WEB_ROOT_PATH || '/';

module.exports = {
  devtool: 'source-map',
  entry: [
    'babel-polyfill',
    path.join(
      __dirname,
      process.env.TEST_RUN ? 'client/test/index' : 'client/main'
    ),
  ].filter((x) => x),
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'temporal.[hash].js',
    publicPath: PUBLIC_PATH,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.TEMPORAL_WEB_ROOT_PATH': `"${PUBLIC_PATH}"`,
    }),
    new ExtractTextPlugin({
      filename: development ? 'temporal.css' : 'temporal.[hash].css',
      allChunks: true,
    }),
    new HtmlWebpackPlugin({
      title: 'Temporal',
      filename: 'index.html',
      favicon: 'favicon.png',
      inject: false,
      template: require('html-webpack-template'),
      lang: 'en-US',
      scripts: (process.env.TEMPORAL_EXTERNAL_SCRIPTS || '')
        .split(',')
        .filter((x) => x),
    }),
  ].filter((x) => x),
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          configFile: path.resolve(__dirname, 'babel.config.js'),
        },
      },
      {
        test: /\.vue?$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            js: {
              loader: 'babel-loader',
              options: {
                configFile: path.resolve(__dirname, 'babel.config.js'),
              },
            },
            stylus: ExtractTextPlugin.extract({
              use: extractStylus,
              fallback: 'vue-style-loader',
            }),
          },
        },
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'html-loader',
            options: {
              minimize: true,
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?[hash]',
        },
      },
      {
        test: /\.styl$/,
        use: ExtractTextPlugin.extract({
          use: extractStylus,
          fallback: 'raw-loader',
        }),
        include: path.join(__dirname, 'src'),
      },
    ],
  },
  resolve: {
    alias: {
      vue$: 'vue/dist/vue.esm.js',
    },
    extensions: ['*', '.js', '.vue', '.json'],
  },
  devServer: {
    historyApiFallback: true,
    overlay: true,
    publicPath: PUBLIC_PATH,
  },
};
