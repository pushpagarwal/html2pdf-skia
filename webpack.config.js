const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

const baseConfig = {
    entry: './src/index.ts',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            "fs": false,
            "path": require.resolve("path-browserify")
        }
    },
    externals: {
        // External dependencies that should not be bundled
    },
    devtool: 'source-map',
    plugins: [
    new CopyPlugin({
      patterns: [
        { from: "node_modules/@rollerbird/canvaskit-wasm-pdf/bin/canvaskit-pdf.wasm", to: "wasm" }
      ],
    }),
  ]
};

// UMD build for browsers
const umdConfig = {
    ...baseConfig,
    output: {
        filename: 'html2pdf-skia.js',
        path: path.resolve(__dirname, 'lib'),
        library: 'html2pdf',
        libraryTarget: 'umd',
        globalObject: 'this',
    },
    target: 'web',
};

// UMD minified build
const umdMinConfig = {
    ...baseConfig,
    output: {
        filename: 'html2pdf-skia.min.js',
        path: path.resolve(__dirname, 'lib'),
        library: 'html2pdf',
        libraryTarget: 'umd',
        globalObject: 'this',
    },
    target: 'web',
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    format: {
                        comments: /^!/,
                    },
                },
            }),
        ],
    },
};

// ESM build
const esmConfig = {
    ...baseConfig,
    output: {
        filename: 'html2pdf-skia.esm.js',
        path: path.resolve(__dirname, 'lib'),
        library: {
            type: 'module',
        },
    },
    experiments: {
        outputModule: true,
    },
    target: 'web',
};

// CommonJS build for Node.js
const cjsConfig = {
    ...baseConfig,
    output: {
        filename: 'html2pdf-skia.cjs.js',
        path: path.resolve(__dirname, 'lib'),
        libraryTarget: 'commonjs2',
    },
    target: 'node',
};

module.exports = [umdConfig, umdMinConfig, esmConfig, cjsConfig];
