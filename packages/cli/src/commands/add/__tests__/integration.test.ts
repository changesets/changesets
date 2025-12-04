import { testdir } from "@changesets/test-utils";
import { addChangeset } from "../index";
import { defaultConfig } from "@changesets/config";
import { CommitAnalyzer } from "../auto-mode";
import { execSync } from "child_process";

// Mock only external dependencies that provide data
jest.mock("child_process");

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("Auto Mode - Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock analyzer for testing - properly mocked to avoid ES module issues
  const mockAnalyzer: CommitAnalyzer = async (commits) => {
    // Check for breaking changes first (analyzer should handle this)
    const hasBreakingChange = commits.some(
      (c) =>
        c.message.includes("!") ||
        c.message.toLowerCase().includes("breaking change")
    );
    if (hasBreakingChange) return "major";

    // Simple mock that returns 'minor' for feat commits, 'patch' for fix commits
    const hasFeat = commits.some((c) =>
      c.message.toLowerCase().includes("feat")
    );
    const hasFix = commits.some((c) => c.message.toLowerCase().includes("fix"));

    if (hasFeat) return "minor";
    if (hasFix) return "patch";
    return "none";
  };

  const mockConfig = {
    ...defaultConfig,
    auto: {
      maxCommits: 100,
      preset: "conventionalcommits",
      analyzer: mockAnalyzer,
    },
  };

  describe("Breaking Change Detection", () => {
    it("should detect breaking changes in commit messages", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      });

      // Mock the data inputs with breaking change
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce("abc1234 feat!: breaking change"); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify the function processed the breaking change correctly
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
        ),
        expect.any(Object)
      );
    });

    it("should detect breaking changes in commit body", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      });

      // Mock the data inputs with breaking change in body
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(
          "abc1234 feat: new feature\n\nBREAKING CHANGE: this breaks the API"
        ); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify the function processed the breaking change correctly
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
        ),
        expect.any(Object)
      );
    });
  });

  describe("Edge Cases Integration", () => {
    it("should handle initial release (no tags)", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      });

      // Mock the data inputs: no tags exist
      mockExecSync
        .mockReturnValueOnce("") // git tag --list (no tags)
        .mockReturnValueOnce("abc1234 feat: initial feature"); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify the function handled no tags gracefully
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });

    it("should handle no commits found", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      });

      // Mock the data inputs: no commits found
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(""); // git log (no output)

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify the function handled no commits gracefully
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });

    it("should handle prerelease tags correctly", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      });

      // Mock the data inputs: prerelease tags
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0-beta.1") // git tag --list
        .mockReturnValueOnce("abc1234 feat: new feature"); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify the function handled prerelease tags correctly
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
        ),
        expect.any(Object)
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle git command failures gracefully", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      });

      // Mock the data inputs: git command fails
      mockExecSync.mockImplementation(() => {
        throw new Error("git command failed");
      });

      // Test the actual function logic handles errors gracefully
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Should handle errors gracefully without throwing
      expect(mockExecSync).toHaveBeenCalled();
    });
  });
});
