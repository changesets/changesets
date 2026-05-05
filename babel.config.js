module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: { node: 22 },
      },
    ],
  ],
  overrides: [{ test: "**/*.ts", presets: ["@babel/preset-typescript"] }],
};
