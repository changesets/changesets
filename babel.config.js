const plugins = [];

if (process.env.NODE_ENV === "test") {
  plugins.push(function ({ types: t }) {
    return {
      visitor: {
        MetaProperty(path) {
          const parentPath = path.parentPath;
          if (
            !parentPath.isMemberExpression() ||
            !parentPath.get("property").isIdentifier({ name: "url" })
          ) {
            return;
          }
          parentPath.replaceWith(t.identifier("__filename"));
        },
      },
    };
  });
}
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: { node: 18 },
      },
    ],
  ],
  plugins,
  overrides: [{ test: "**/*.ts", presets: ["@babel/preset-typescript"] }],
};
