// TODO [engine:node@>=24]: remove when supported by minimum node version
export const SuppressedError =
  globalThis.SuppressedError ??
  class SuppressedError extends Error {
    name = "SuppressedError" as const;
    error: unknown;
    suppressed: unknown;

    constructor(error: unknown, suppressed: unknown, message?: string) {
      super(message ?? "An error was suppressed during disposal.");
      this.error = error;
      this.suppressed = suppressed;
    }
  };

type DisposableValue = AsyncDisposable | Disposable | null | undefined;
type DisposeCallback = () => PromiseLike<void> | void;

export const AsyncDisposableStack =
  globalThis.AsyncDisposableStack ||
  class AsyncDisposableStack {
    #disposed = false;
    #disposers: DisposeCallback[] = [];

    get disposed() {
      return this.#disposed;
    }

    use<T extends DisposableValue>(value: T): T {
      this.#assertActive();
      if (value == null) {
        return value;
      }

      if (Symbol.asyncDispose in value) {
        const asyncDispose = value[Symbol.asyncDispose];
        this.#disposers.push(() => asyncDispose.call(value));
        return value;
      }

      if (Symbol.dispose in value) {
        const dispose = value[Symbol.dispose];
        this.#disposers.push(() => dispose.call(value));
        return value;
      }

      throw new TypeError("Object is not disposable.");
    }

    adopt<T>(
      value: T,
      onDisposeAsync: (value: T) => PromiseLike<void> | void,
    ): T {
      this.#assertActive();
      this.#disposers.push(() => onDisposeAsync(value));
      return value;
    }

    defer(onDisposeAsync: () => PromiseLike<void> | void): void {
      this.#assertActive();
      this.#disposers.push(onDisposeAsync);
    }

    move(): AsyncDisposableStack {
      this.#assertActive();
      const stack = new AsyncDisposableStack();
      stack.#disposers = this.#disposers;
      this.#disposers = [];
      this.#disposed = true;
      return stack;
    }

    async disposeAsync(): Promise<void> {
      if (this.#disposed) {
        return;
      }
      this.#disposed = true;

      let error: unknown;
      let hasError = false;
      while (this.#disposers.length > 0) {
        const dispose = this.#disposers.pop()!;
        try {
          await dispose();
        } catch (disposeError) {
          error = hasError
            ? new SuppressedError(disposeError, error)
            : disposeError;
          hasError = true;
        }
      }

      if (hasError) {
        throw error;
      }
    }

    async [Symbol.asyncDispose](): Promise<void> {
      await this.disposeAsync();
    }

    #assertActive() {
      if (this.#disposed) {
        throw new ReferenceError("AsyncDisposableStack is already disposed.");
      }
    }
  };
