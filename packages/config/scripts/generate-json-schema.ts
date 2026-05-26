import fs from "node:fs/promises";
import path from "node:path";
import { type JsonSchema, toJsonSchema } from "@valibot/to-json-schema";
import { format } from "oxfmt";
import { WrittenConfigSchema } from "../src/config.ts";

export async function generateJsonSchema(write = true): Promise<string> {
  const sortKeysInSchema = ({ $schema, ...schema }: JsonSchema) => {
    return {
      $schema,
      ...schema,
    };
  };

  const schema = toJsonSchema(WrittenConfigSchema, {
    target: "draft-2020-12",
    typeMode: "input",
    errorMode: "throw",
  });
  const schemaString = JSON.stringify(sortKeysInSchema(schema), null, 2);

  const result = await format("schema.json", schemaString);
  if (result.errors.length !== 0) {
    throw new Error("Failed to format generated JSON schema.", {
      cause: result.errors,
    });
  }

  if (write) {
    const packageRoot = path.resolve(import.meta.dirname, "..");
    await fs.writeFile(path.join(packageRoot, "schema.json"), result.code);
  }

  return result.code;
}

// eslint-disable-next-line n/no-unsupported-features/node-builtins
if (import.meta.main) {
  await generateJsonSchema();
}
