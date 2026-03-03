interface PromiseWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

function withResolvers<T>(): PromiseWithResolvers<T> {
  const rv = {} as PromiseWithResolvers<T>;
  rv.promise = new Promise<T>((resolve, reject) => {
    rv.resolve = resolve;
    rv.reject = reject;
  });
  return rv;
}

function promiseTry<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => resolve(fn()));
}

export function createPromiseQueue(concurrency: number) {
  const jobs: Array<{
    fn: () => Promise<unknown>;
    resolve: PromiseWithResolvers<unknown>["resolve"];
    reject: PromiseWithResolvers<unknown>["reject"];
  }> = [];

  let active = 0;

  function run() {
    if (active >= concurrency) {
      return;
    }

    const job = jobs.shift();

    if (!job) {
      return;
    }

    active++;

    promiseTry(job.fn).then(
      (result) => {
        active--;
        job.resolve(result);
        run();
      },
      (error) => {
        active--;
        job.reject(error);
        run();
      }
    );
  }

  return {
    add: <T>(fn: () => Promise<T>): Promise<T> => {
      const { promise, resolve, reject } = withResolvers();
      jobs.push({
        fn,
        resolve,
        reject,
      });
      run();
      return promise as Promise<T>;
    },
    setConcurrency: (newConcurrency: number) => {
      concurrency = newConcurrency;
      run();
    },
  };
}
