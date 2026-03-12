import { shouldUpdateDependencyBasedOnConfig } from "./utils";

const base = {
  minReleaseType: "patch" as const,
  onlyUpdatePeerDependentsWhenOutOfRange: false,
};

describe("shouldUpdateDependencyBasedOnConfig", () => {
  describe("plain semver ranges", () => {
    it("returns true when version leaves the semver range", () => {
      expect(
        shouldUpdateDependencyBasedOnConfig(
          { version: "2.0.0", type: "major" },
          { depVersionRange: "^1.0.0", depType: "dependencies" },
          base
        )
      ).toBe(true);
    });

    it("returns false when version stays within the semver range and bump is below min", () => {
      expect(
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.0.1", type: "patch" },
          { depVersionRange: "^1.0.0", depType: "dependencies" },
          { minReleaseType: "minor", onlyUpdatePeerDependentsWhenOutOfRange: false }
        )
      ).toBe(false);
    });
  });

  describe("explicit workspace: ranges (e.g. workspace:^1.0.0)", () => {
    it("returns false when the new version satisfies workspace:^1.0.0 and bump is below min", () => {
      // 1.0.1 satisfies ^1.0.0 — should NOT force an update
      expect(
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.0.1", type: "patch" },
          { depVersionRange: "workspace:^1.0.0", depType: "dependencies" },
          { minReleaseType: "minor", onlyUpdatePeerDependentsWhenOutOfRange: false }
        )
      ).toBe(false);
    });

    it("returns true when the new version leaves workspace:^1.0.0 range", () => {
      // 2.0.0 does not satisfy ^1.0.0 — should always update
      expect(
        shouldUpdateDependencyBasedOnConfig(
          { version: "2.0.0", type: "major" },
          { depVersionRange: "workspace:^1.0.0", depType: "dependencies" },
          base
        )
      ).toBe(true);
    });

    it("returns false when version satisfies workspace:~1.2.3 and bump is below min", () => {
      expect(
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.2.4", type: "patch" },
          { depVersionRange: "workspace:~1.2.3", depType: "dependencies" },
          { minReleaseType: "minor", onlyUpdatePeerDependentsWhenOutOfRange: false }
        )
      ).toBe(false);
    });

    it("returns true when version leaves workspace:~1.2.3 range", () => {
      expect(
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.3.0", type: "minor" },
          { depVersionRange: "workspace:~1.2.3", depType: "dependencies" },
          base
        )
      ).toBe(true);
    });
  });

  describe("implicit workspace aliases (workspace:^, workspace:~, workspace:*)", () => {
    it("does not throw and returns config-based result for workspace:^", () => {
      // workspace:^ is not a real semver range; it should not crash
      expect(() =>
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.1.0", type: "minor" },
          { depVersionRange: "workspace:^", depType: "dependencies" },
          base
        )
      ).not.toThrow();
    });

    it("does not throw for workspace:~", () => {
      expect(() =>
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.1.0", type: "minor" },
          { depVersionRange: "workspace:~", depType: "dependencies" },
          base
        )
      ).not.toThrow();
    });

    it("does not throw for workspace:*", () => {
      expect(() =>
        shouldUpdateDependencyBasedOnConfig(
          { version: "1.1.0", type: "minor" },
          { depVersionRange: "workspace:*", depType: "dependencies" },
          base
        )
      ).not.toThrow();
    });
  });
});
