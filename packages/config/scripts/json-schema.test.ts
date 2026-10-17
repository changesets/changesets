import { expect, it } from "vitest";
import { generateJsonSchema } from "./generate-json-schema.ts";

it("can generate a json schema", async () => {
  await expect(generateJsonSchema(false)).resolves.not.toThrow();
});

it("generates a correct json schema", async () => {
  const schema = await generateJsonSchema(false);

  await expect(schema).toMatchFileSnapshot("../schema.json");
});

it("describes include as an optional array of package patterns", async () => {
  const schema = JSON.parse(await generateJsonSchema(false));
  expect(schema.properties.include).toMatchObject({
    type: "array",
    items: { type: "string" },
  });
  expect(schema.required ?? []).not.toContain("include");
  expect(schema.properties.include).not.toHaveProperty("default");
});
