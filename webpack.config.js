const path = require('path');
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  entry: './src/script-runner.js',
  target: ['web'],
  output: {
    filename: './script-runner.js',
    path: path.resolve(__dirname, 'build')
  },
  devtool: 'source-map',
  resolve: {
    fallback: {
      assert: false,
      path: require.resolve("path-browserify"),
      stream: require.resolve("stream-browserify"),
      'process/browser': require.resolve("process/browser"),
      buffer: require.resolve("buffer"),
      fs: false,
      os: false,
      crypto: require.resolve("crypto-browserify"),
      constants: require.resolve("constants-browserify"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      zlib: false,
      v8: require.resolve("./polyfills/v8.js"),
      net: require.resolve("net-browserify"),
      querystring: require.resolve("querystring-es3"),
      tty: require.resolve("tty-browserify"),
      module: false,
      worker_threads: false,
      child_process: false,
      'timers/promises': false,
      '@yarnpkg/cli': false,
      dns: false,
      async_hooks: false,
      stream: require.resolve('stream-browserify')
    },
    alias: {
      process: 'process/browser',
    }
  },
  experiments: {
    syncWebAssembly: true
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: 'process/browser',
    })
  ]
};