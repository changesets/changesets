import { once } from "node:events";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type OutputEvent = {
  type: "git-tag";
  tag: string;
  packageName: string;
};

export interface OutputReporter {
  write(event: OutputEvent): void;
  [Symbol.asyncDispose](): Promise<void>;
}

export async function createOutputReport(
  outputPath: string | undefined,
): Promise<OutputReporter | undefined> {
  if (!outputPath) {
    return undefined;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const stream = createWriteStream(outputPath, { flags: "a" });
  // Keep a listener attached for the stream's whole life: an unhandled
  // "error" event would otherwise crash the process, possibly mid-publish.
  let streamError: Error | undefined;
  stream.on("error", (error) => {
    streamError ??= error;
  });
  // Surface open failures (EISDIR, EACCES, ...) before anything is published.
  await once(stream, "open");

  return {
    write(event) {
      stream.write(`${JSON.stringify(event)}\n`);
    },
    async [Symbol.asyncDispose]() {
      if (streamError) {
        throw streamError;
      }
      stream.end();
      await once(stream, "finish");
    },
  };
}
