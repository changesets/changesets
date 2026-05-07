// TODO [engine:node@>=23]: remove when supported by minimum node version
const promiseTryPolyfill = <R, Args extends unknown[]>(
  fn: (...args: Args) => Promise<R> | R,
  ...args: Args
): Promise<Awaited<R>> =>
  new Promise((resolve) => resolve(fn(...args) as Awaited<R>));

export const promiseTry =
  "try" in Promise ? Promise.try.bind(Promise) : promiseTryPolyfill;
