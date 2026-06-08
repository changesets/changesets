import { expect, it } from "vitest";
import { editJson } from "./edit-json.ts";

it("updates a direct value", () => {
  const json = `{"name":"pkg-a","version":"1.0.0"}`;

  const result = editJson(json, [
    {
      keys: ["version"],
      value: "^2.0.0",
    },
  ]);

  expect(result).toMatchInlineSnapshot(`"{"name":"pkg-a","version":"^2.0.0"}"`);
});

it("updates a nested value", () => {
  const json = `{"name":"pkg-a","version":"1.0.0","dependencies":{"pkg-b":"^1.0.0"}}`;

  const result = editJson(json, [
    {
      keys: ["dependencies", "pkg-b"],
      value: "^2.0.0",
    },
  ]);

  expect(result).toMatchInlineSnapshot(
    `"{"name":"pkg-a","version":"1.0.0","dependencies":{"pkg-b":"^2.0.0"}}"`,
  );
});

it("updates a multiple values", () => {
  const json = `{"name":"pkg-a","version":"1.0.0","dependencies":{"pkg-b":"^1.0.0"}}`;

  const result = editJson(json, [
    {
      keys: ["version"],
      value: "2.0.0-longer-than-before.0",
    },
    {
      keys: ["dependencies", "pkg-b"],
      value: "^2.0.0",
    },
  ]);

  expect(result).toMatchInlineSnapshot(
    `"{"name":"pkg-a","version":"2.0.0-longer-than-before.0","dependencies":{"pkg-b":"^2.0.0"}}"`,
  );
});

it("preserves formatting", () => {
  const json = ` {"name" :"pkg-a" ,"version":"1.0.0"} `;

  const result = editJson(json, [
    {
      keys: ["version"],
      value: "^2.0.0",
    },
  ]);

  expect(result).toMatchInlineSnapshot(
    `" {"name" :"pkg-a" ,"version":"^2.0.0"} "`,
  );
});

it("throws when a key path does not exist", () => {
  const json = `{"name":"pkg-a"}`;

  expect(() => {
    editJson(json, [
      {
        keys: ["version"],
        value: "1.1.0",
      },
    ]);
  }).toThrow('Key path "version" not found in JSON');
});
