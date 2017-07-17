const webpack = require('webpack')
const path = require('path')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const plugins = {
  extractTextPlugin: new ExtractTextPlugin({filename: 'css/main.css', allChunks: true})
}

module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets:['es2015', 'react', 'stage-2']
        },
        include: path.resolve(__dirname, '../'),
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract({
          loader: 'css-loader?importLoaders=1!postcss-loader'
        }),
        include: path.resolve(__dirname, '../'),
      },
    ]
  },
  plugins: [
    plugins.extractTextPlugin,
  ]
}
