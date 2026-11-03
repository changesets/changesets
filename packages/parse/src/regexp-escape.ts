// TODO[engine:node@>=24]: remove once we drop support for node <24, use `RegExp.escape` directly
export const escapeRegExp: (str: string) => string =
  (RegExp as { escape?: (str: string) => string }).escape ??
  ((str: string) => str.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"));
