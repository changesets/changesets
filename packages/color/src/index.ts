// Lint has invalid data, styleText is supported experimentally since node 22.0
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { styleText } from "node:util";

type Color = Extract<Parameters<typeof styleText>[0], string>;
type ColorProxy = Record<Color, (text: string) => string>;

export default new Proxy({} as ColorProxy, {
  get(target, color: Color) {
    target[color] ??= (text) => styleText(color, text);
    return target[color];
  },
});
