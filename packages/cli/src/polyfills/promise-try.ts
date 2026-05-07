// TODO [engine:node@>=23]: remove when supported by minimum node version
function promiseTry<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => resolve(fn()));
}

// @ts-expect-error: overriding built-in
Promise.try = promiseTry;
