const path = require('path');
const webpack = require('webpack')

module.exports = {
  entry: './src/script-runner.js',
  target: ['web'],
  output: {
    filename: './script-runner.js',
    path: path.resolve(__dirname, 'build')
  },
  resolve: {
    alias: {
      path: require.resolve("path-browserify"),
      stream: require.resolve("stream-browserify"),
      process: "process/browser",
      buffer: require.resolve("buffer"),
      fs: false
    },
    fallback: {
      fs: false
    }
  },
  experiments: {
    syncWebAssembly: true
  },
  plugins: [
    new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ["buffer", "Buffer"],
        })
    ]
};