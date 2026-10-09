const webpack = require('webpack')
const ejs = require('ejs')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const WebpackShellPlugin = require('webpack-shell-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ChromeExtensionReloader = require('webpack-chrome-extension-reloader')
const { VueLoaderPlugin } = require('vue-loader')
const { version } = require('./package.json')

const config = {
    devtool: 'cheap-module-source-map',
    mode: process.env.NODE_ENV,
    context: __dirname + '/src',
    entry: process.env.HMR === 'true' ? {
        // В HMR режиме background копируется как статический файл
        'popup/popup': './popup/popup.js',
        'options/options': './options/options.js'
    } : {
        'background': './background.js',
        'popup/popup': './popup/popup.js',
        'options/options': './options/options.js'
    },
    output: {
        path: __dirname + '/dist',
        filename: '[name].js',
        publicPath: ''
    },
    resolve: {
        extensions: ['.js', '.vue']
    },
    optimization: {
        // Отключаем runtime chunk для background script
        runtimeChunk: false,
        splitChunks: {
            cacheGroups: {
                // Не создаем vendor chunks для background
                default: false,
                vendors: false
            }
        }
    },
    module: {
        rules: [{
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            },
            {
                test: /\.scss$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']
            },
            {
                test: /\.sass$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader?indentedSyntax']
            },
            {
                test: /\.(png|jpg|gif|svg|ico)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    emitFile: false
                }
            }
        ]
    },
    plugins: [
        new VueLoaderPlugin(),
        new MiniCssExtractPlugin({
            filename: '[name].css'
        }),
        new CopyWebpackPlugin([
            { from: '_locales', to: '_locales' },
            { from: 'assets', to: 'assets' },
            { from: 'icons', to: 'icons', ignore: ['icon.xcf'] },
            { from: 'popup/popup.html', to: 'popup/popup.html', transform: transformHtml },
            { from: 'options/options.html', to: 'options/options.html', transform: transformHtml },
            // Hot reload файлы только для development
            ...(process.env.NODE_ENV === 'development' ? [
                { from: 'popup/hot-reload.js', to: 'popup/hot-reload.js' }
            ] : []),
            // В HMR режиме используем простой background script
            ...(process.env.HMR === 'true' ? [
                { from: 'background-simple.js', to: 'background.js' }
            ] : []),
            {
                from: 'manifest.json',
                to: 'manifest.json',
                transform: (content) => {
                    const jsonContent = JSON.parse(content)
                    jsonContent.version = version

                    jsonContent['content_security_policy'] = {
                        extension_pages: "script-src 'self'; object-src 'self'; frame-src 'self' https://clash.gg"
                    }

                    if (process.env.NODE_ENV === 'development') {
                        // Добавляем префикс [DEV] к названию расширения если его еще нет
                        if (!jsonContent.name.includes('[DEV]')) {
                            jsonContent.name = jsonContent.name.replace('__MSG_extensionName__', '[DEV] __MSG_extensionName__')
                        }

                        jsonContent['content_security_policy'] = {
                                extension_pages: "script-src 'self'; object-src 'self'; frame-src 'self' https://clash.gg; connect-src 'self' https://open.faceit.com https://o4509418472013824.ingest.de.sentry.io https://www.google-analytics.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com"
                            }
                            // Add permissions needed for hot reload
                        if (!jsonContent.permissions.includes('tabs')) {
                            jsonContent.permissions.push('tabs')
                        }
                        if (!jsonContent.permissions.includes('storage')) {
                            jsonContent.permissions.push('storage')
                        }
                    }

                    return JSON.stringify(jsonContent, null, 2)
                }
            }
        ])
    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins = (config.plugins || []).concat([
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: '"production"'
            }
        })
    ])
}

if (process.env.HMR === 'true') {
    config.plugins = (config.plugins || []).concat([
        new ChromeExtensionReloader({
            port: 9090,
            reloadPage: true,
            entries: {
                // Полностью исключаем background script для Manifest V3 совместимости
                extensionPage: ['popup/popup', 'options/options']
            }
        })
    ])
}

// Add shell plugin only for production and single builds
if (process.env.NODE_ENV === 'production' || !process.env.HMR) {
    config.plugins.push(
        new WebpackShellPlugin({
            onBuildEnd: ['node scripts/remove-evals.js']
        })
    )
}

function transformHtml(content) {
    return ejs.render(content.toString(), {
        ...process.env
    })
}

module.exports = config