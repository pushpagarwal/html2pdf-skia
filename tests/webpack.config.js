const path = require('path');

module.exports = {
    entry: './tests/testrunner.ts',
    output: {
        filename: 'testrunner.js',
        path: path.resolve(__dirname, '../build'),
        library: 'testrunner',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    devtool: 'source-map',
    target: 'web',
    mode: 'development'
};
