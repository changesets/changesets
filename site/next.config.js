module.exports = {
  webpack(config, options) {
    config.module.rules.push({
      test: /\.+(js|jsx|ts|tsx)$/,
      use: options.defaultLoaders.babel,
      exclude: [/node_modules/]
    });
    return config;
  }
};
