// supported and working as expected in Node 22.08+
// https://nodejs.org/docs/latest-v22.x/api/util.html#utilstyletextformat-text-options
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { styleText } from "node:util";

type Color = Exclude<Parameters<typeof styleText>[0], Array<unknown>>;
type ColorProxy = Record<Color, (text: string) => string>;

export default new Proxy({} as ColorProxy, {
  get(_, color: Color) {
    return (text: string) => styleText(color, text);
  },
});
