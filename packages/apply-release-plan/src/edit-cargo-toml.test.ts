import { describe, expect, it } from "vitest";
import { editCargoTomlVersion } from "./edit-cargo-toml.ts";

describe("editCargoTomlVersion", () => {
  it("updates the version field in the [package] section", () => {
    const toml = `[package]
name = "my-crate"
version = "0.1.0"
edition = "2021"
`;
    expect(editCargoTomlVersion(toml, "0.2.0")).toBe(`[package]
name = "my-crate"
version = "0.2.0"
edition = "2021"
`);
  });

  it("preserves comments and unrelated formatting", () => {
    const toml = `# top comment
[package]
name = "my-crate" # crate name
version = "0.1.0" # crate version

[dependencies]
version = "9.9.9"
`;
    expect(editCargoTomlVersion(toml, "1.0.0")).toBe(`# top comment
[package]
name = "my-crate" # crate name
version = "1.0.0" # crate version

[dependencies]
version = "9.9.9"
`);
  });

  it("supports single-quoted version strings", () => {
    const toml = `[package]\nversion = '0.1.0'\n`;
    expect(editCargoTomlVersion(toml, "0.2.0")).toBe(
      `[package]\nversion = '0.2.0'\n`,
    );
  });

  it("throws when there is no [package] section", () => {
    expect(() =>
      editCargoTomlVersion(`[workspace]\nmembers = ["."]\n`, "0.2.0"),
    ).toThrow(/\[package\]/);
  });

  it("throws when the version is workspace-inherited", () => {
    const toml = `[package]\nname = "my-crate"\nversion.workspace = true\n`;
    expect(() => editCargoTomlVersion(toml, "0.2.0")).toThrow(
      /version\.workspace = true/,
    );
  });
});
