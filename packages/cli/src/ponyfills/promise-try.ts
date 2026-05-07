// TODO [engine:node@>=23]: remove when supported by minimum node version
const promiseTryPolyfill = <T>(fn: () => Promise<T> | T): Promise<T> =>
  new Promise((resolve) => resolve(fn()));

export const promiseTry =
  "try" in Promise ? Promise.try.bind(Promise) : promiseTryPolyfill;
