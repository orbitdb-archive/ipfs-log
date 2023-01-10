import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

export default (env, argv) => {
  const require = createRequire(import.meta.url)
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  return {
    devtool: 'source-map',
    entry: './examples/entry.js',
    output: {
      libraryTarget: 'global',
      filename: '../examples/browser/bundle.js'
    },
    target: 'web',
    externals: {
      fs: '{}',
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
        path: require.resolve('path-browserify'),
        stream: require.resolve('stream-browserify')
      }
    }
  }
}
