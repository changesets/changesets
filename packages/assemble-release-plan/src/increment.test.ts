// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";
import { incrementVersion } from "./increment.ts";
import type { InternalRelease, PreInfo } from "./types.ts";

describe("incrementVersion", () => {
  describe("pre mode", () => {
    it("should not bump version for releases with release type 'none'", () => {
      const fakeRelease: InternalRelease = {
        name: "pkg-a",
        type: "none",
        changesets: [],
        oldVersion: "1.0.0",
      };

      const fakePreInfo: PreInfo = {
        preVersions: new Map(),
        state: {
          mode: "pre",
          tag: "next",
          initialVersions: {},
          changesets: [],
        },
      };

      const nextVersion = incrementVersion(fakeRelease, fakePreInfo);
      expect(nextVersion).toBe("1.0.0");
    });
  });
});
