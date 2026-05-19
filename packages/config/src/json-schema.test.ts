import { expect, it } from "vitest";
import { generateJsonSchema } from "./json-schema.ts";

it("can generate a json schema", async () => {
  await expect(generateJsonSchema(false)).resolves.not.toThrow();
});

it("generates a correct json schema", async () => {
  const schema = await generateJsonSchema(false);

  await expect(schema).toMatchFileSnapshot("../schema.json");
});
