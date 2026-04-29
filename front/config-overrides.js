const webpack = require('webpack');

module.exports = function override(config, env) {
  // Polyfills de Node para Webpack 5
  config.resolve.fallback = {
    ...config.resolve.fallback,
    process: require.resolve('process/browser.js'), // <-- con .js
    buffer: require.resolve('buffer'),
  };

  // Alias por si algún import usa 'process/browser'
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    process: 'process/browser.js',
  };

  // Relajar fullySpecified para ESM en node_modules (opcional pero útil)
  config.module.rules = [
    ...(config.module.rules || []),
    {
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    },
  ];

  // Inyectar process y Buffer globales
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  // Ignorar warnings de sourcemaps
  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
};
