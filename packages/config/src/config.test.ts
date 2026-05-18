import { type JsonSchema, toJsonSchema } from "@valibot/to-json-schema";
import { describe, expect, it } from "vitest";
import { WrittenConfigSchema } from "./config.ts";

const sortKeysInSchema = ({ $schema, ...schema }: JsonSchema) => {
  return {
    $schema,
    ...schema,
  };
};

describe("WrittenConfig", () => {
  it("can generate a json schema", () => {
    expect(() => toJsonSchema(WrittenConfigSchema)).not.toThrow();
  });

  it("generates a correct json schema", async () => {
    const schema = toJsonSchema(WrittenConfigSchema, {
      target: "draft-2020-12",
      errorMode: "throw",
    });
    const schemaString = JSON.stringify(sortKeysInSchema(schema), null, 2);

    await expect(schemaString).toMatchFileSnapshot("../schema.json");
  });
});

// tests for the config schema and rules are in `parse.test.ts` as we want to make sure
// they are working correctly inside of `readAndValidateConfig`
