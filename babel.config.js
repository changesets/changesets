module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: { node: 20 },
      },
    ],
  ],
  overrides: [{ test: "**/*.ts", presets: ["@babel/preset-typescript"] }],
};
