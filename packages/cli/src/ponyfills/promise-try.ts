// TODO [engine:node@>=23]: remove when supported by minimum node version
const polyfill = <T>(fn: () => Promise<T> | T): Promise<T> =>
  new Promise((resolve) => resolve(fn()));

export const promiseTry = Promise.try ?? polyfill;
