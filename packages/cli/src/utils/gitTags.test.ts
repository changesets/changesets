import { describe, expect, it } from "vitest";
import { buildGitTag } from "./gitTags.ts";

const monorepo = { type: "pnpm" } as const;
const root = { type: "root" } as const;

describe("buildGitTag", () => {
  it("uses the default formats when gitTagFormat is not set", () => {
    expect(
      buildGitTag(monorepo, { name: "pkg-a", version: "1.0.0" }, undefined),
    ).toBe("pkg-a@1.0.0");
    expect(
      buildGitTag(root, { name: "pkg-a", version: "1.0.0" }, undefined),
    ).toBe("v1.0.0");
  });

  it("replaces every occurrence of the variable patterns", () => {
    expect(
      buildGitTag(
        monorepo,
        { name: "@scope/pkg-a", version: "1.0.0" },
        "{name}/v{version}/{name}",
      ),
    ).toBe("@scope/pkg-a/v1.0.0/@scope/pkg-a");
  });

  it("does not interpret replacement patterns in the values", () => {
    expect(
      buildGitTag(
        monorepo,
        { name: "pkg$&", version: "1.0.0" },
        "{name}@{version}",
      ),
    ).toBe("pkg$&@1.0.0");
  });

  it("does not substitute variable patterns coming from the values", () => {
    expect(
      buildGitTag(
        monorepo,
        { name: "pkg-{version}", version: "1.0.0" },
        "{name}_{version}",
      ),
    ).toBe("pkg-{version}_1.0.0");
  });
});
