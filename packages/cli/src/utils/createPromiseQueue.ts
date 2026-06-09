import { promiseTry } from "../ponyfills/promise-try.ts";

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
      },
    );
  }

  return {
    add: <T>(fn: () => Promise<T>): Promise<T> => {
      const { promise, resolve, reject } = Promise.withResolvers<unknown>();
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
