// @flow

import Typography from "typography";
import colors from "./colors";

export default new Typography({
  baseFontSize: "16px",
  baseLineHeight: 1.5,
  scaleRatio: 3,
  headerFontFamily: ["Roboto", "system-ui", "sans-serif"],
  bodyFontFamily: ["Roboto", "system-ui", "sans-serif"],
  headerColor: "inherit",
  bodyColor: "inherit",
  includeNormalize: false,
  overrideStyles: () => ({
    a: {
      color: colors.blue
    },
    pre: {
      fontFamily: '"Roboto Mono", Menlo, monospace',
      color: colors.blue
    },
    code: {
      fontFamily: '"Roboto Mono", Menlo, monospace',
      color: colors.blue
      // backgroundColor: colors.gray,
    }
  }),
  googleFonts: [
    {
      name: "Roboto",
      styles: ["400", "700"]
    },
    {
      name: "Roboto Mono",
      styles: ["400", "700"]
    }
  ]
});
