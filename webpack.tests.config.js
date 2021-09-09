'use strict'

const glob = require('glob')
const webpack = require('webpack')
const path = require('path')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

module.exports = {
  // TODO: put all tests in a .js file that webpack can use as entry point
  entry: glob.sync('./test/*.spec.js', { ignore: ['./test/replicate.spec.js'] }),
  output: {
    filename: '../test/browser/bundle.js'
  },
  target: 'web',
  devtool: 'source-map',
  mode: 'development',
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV)
      }
    }),
    new webpack.IgnorePlugin(/mongo|redis/),
    new NodePolyfillPlugin()
  ],
  externals: {
    fs: '{ existsSync: () => true }',
    fatfs: '{}',
    'fs-extra': '{ copy: () => {} }',
    rimraf: '{ sync: () => {} }',
    'idb-readable-stream': '{}',
    runtimejs: '{}',
    net: '{}',
    child_process: {},
    dns: '{}',
    tls: '{}',
    bindings: '{}'
  },
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    fallback: {
      assert: require.resolve('assert'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify')
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              '@babel/syntax-object-rest-spread',
              '@babel/transform-runtime',
              '@babel/plugin-transform-modules-commonjs',
              '@babel/plugin-proposal-nullish-coalescing-operator',
              '@babel/plugin-proposal-optional-chaining'
            ]
          }
        }
      },
      // For inlining the fixture keys in browsers tests
      {
        test: /userA|userB|userC|userD|0358df8eb5def772917748fdf8a8b146581ad2041eae48d66cc6865f11783499a6|032f7b6ef0432b572b45fcaf27e7f6757cd4123ff5c5266365bec82129b8c5f214|02a38336e3a47f545a172c9f77674525471ebeda7d6c86140e7a778f67ded92260|03e0480538c2a39951d054e17ff31fde487cb1031d0044a037b53ad2e028a3e77c$/,
        loader: 'json-loader'
      }
    ]
  }
}
