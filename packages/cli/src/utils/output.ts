import { once } from "node:events";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type OutputEvent =
  | {
      type: "git-tag";
      tag: string;
      packageName: string;
    }
  | {
      type: "npm-stage";
      packageName: string;
      version: string;
      tag: string;
      gitTag: string;
      stageId: string;
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

  return {
    write(event) {
      stream.write(`${JSON.stringify(event)}\n`);
    },
    async [Symbol.asyncDispose]() {
      stream.end();
      await once(stream, "finish");
    },
  };
}
