const webpack = require('webpack')
const path = require('path')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const plugins = {
  extractTextPlugin: new ExtractTextPlugin({filename: 'css/main.css', allChunks: true})
}

module.exports = {
  entry: './client/main.js',
  output: {
    path: path.resolve('build'),
    filename: 'index_bundle.js',
    publicPath: '/build/',
    libraryTarget: 'umd',
    library: 'ZensaCheckout'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets:['es2015', 'react']
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract({
          loader: 'css-loader?importLoaders=1!postcss-loader'
        }),
      },
    ]
  },
  plugins: [
    plugins.extractTextPlugin,
  ]
}
