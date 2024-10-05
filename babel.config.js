module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: { node: 18 },
      },
    ],
  ],
  overrides: [{ test: "**/*.ts", presets: ["@babel/preset-typescript"] }],
};
