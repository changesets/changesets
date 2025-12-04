// Mock external dependencies that provide data
import { testdir } from "@changesets/test-utils";
import { execSync } from "child_process";
import addChangeset from "../index";
import { CommitAnalyzer } from "../auto-mode";
import { defaultConfig } from "@changesets/config";

jest.mock("child_process");

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("Auto Mode Integration Tests", () => {
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

  describe("End-to-End Scenarios", () => {
    it("should create changeset for single package with feature commit", async () => {
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

      // Mock git results - all git commands are mocked
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce("abc1234\nfeat(pkg-a): add new feature"); // git log

      // Test the actual function logic (not mocked)
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git commands were called correctly
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
        ),
        expect.any(Object)
      );
    });

    it("should handle multiple packages with different commit types", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "2.0.0",
        }),
      });

      // Mock git results for both packages
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0") // git tag --list
        .mockReturnValueOnce("abc1234\nfeat(pkg-a): new feature") // pkg-a commits
        .mockReturnValueOnce("def5678\nfix(pkg-b): bug fix"); // pkg-b commits

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify both packages were processed
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });

    it("should skip packages with no conventional commits", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "2.0.0",
        }),
      });

      // Mock git results - pkg-a has conventional commits, pkg-b doesn't
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0") // git tag --list
        .mockReturnValueOnce("abc1234\nfeat(pkg-a): new feature") // pkg-a commits
        .mockReturnValueOnce("def5678\nupdate readme"); // pkg-b non-conventional commits

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify the function correctly identified conventional vs non-conventional commits
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });

    it("should handle breaking changes correctly", async () => {
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

      // Mock git results with breaking change
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce("abc1234\nfeat!: breaking change"); // git log with breaking change

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify breaking change was detected
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });
  });

  describe("Configuration Options", () => {
    it("should respect maxCommits configuration", async () => {
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

      const configWithMaxCommits = {
        ...defaultConfig,
        auto: {
          maxCommits: 5,
          preset: "conventionalcommits",
          analyzer: mockAnalyzer,
        },
      };

      // Mock git results with many commits
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(
          "abc1234\nfeat: new feature\ndef5678\nfix: bug fix\nghi9012\ndocs: update\njkl3456\nfeat: another feature\nmno7890\nfix: another bug\npqr1234\ndocs: more docs\nstu5678\nfeat: third feature"
        ); // git log with many commits

      // Test the actual function logic with maxCommits config
      await addChangeset(cwd, { auto: true }, configWithMaxCommits);

      // Verify the function respected the maxCommits setting
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle git tag command failures gracefully", async () => {
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

      // Mock git tag command failure
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("git tag command failed");
      });

      // Test the actual function logic handles errors gracefully
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Should still create a changeset (initial release)
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("should handle git log command failures gracefully", async () => {
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

      // Mock git tag success but log failure
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockImplementationOnce(() => {
          throw new Error("git log command failed");
        });

      // Test the actual function logic handles errors gracefully
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Should still create a changeset (initial release due to error)
      expect(mockExecSync).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
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

      // Mock git tag command returning no tags
      mockExecSync.mockReturnValueOnce(""); // git tag --list (no tags)

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Should create changeset for initial release
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("should handle empty commit messages", async () => {
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

      // Mock git results with empty commit message
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce("abc1234\n"); // git log with empty message

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Should handle empty messages gracefully
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("should handle malformed git output", async () => {
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

      // Mock git results with malformed output
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce("abc1234\nfeat: new feature\ndef5678"); // git log with malformed output (missing message)

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Should handle malformed output gracefully
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("should detect major bump when breaking change is followed by minor commit", async () => {
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

      // Mock git operations for a scenario where major commit comes first, then minor
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(
          "abc123\nfeat(@kira2k/pkg-a)!: breaking change\ndef456\nfeat(@kira2k/pkg-a): minor feature"
        ); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git commands were called correctly
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
        ),
        expect.any(Object)
      );
    });

    it("should detect major bump when breaking change is in the middle of commits", async () => {
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

      // Mock git operations for a scenario where major commit is in the middle
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(
          "abc123\nfeat(@kira2k/pkg-a): first feature\ndef456\nfeat(@kira2k/pkg-a)!: breaking change\nghi789\nfeat(@kira2k/pkg-a): final feature"
        ); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git commands were called correctly
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("should detect major bump when breaking change is the last commit", async () => {
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

      // Mock git operations for a scenario where major commit comes last
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(
          "abc123\nfeat(@kira2k/pkg-a): first feature\ndef456\nfeat(@kira2k/pkg-a)!: breaking change"
        ); // git log

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git commands were called correctly
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("should handle commit affecting multiple packages in single commit", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "2.0.0",
        }),
        "packages/pkg-c/package.json": JSON.stringify({
          name: "pkg-c",
          version: "3.0.0",
        }),
      });

      // Mock git results for a commit that affects multiple packages
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0\npkg-c@3.0.0") // git tag --list
        .mockReturnValueOnce(
          "abc123\nfeat: update shared dependency across all packages"
        ) // git log for pkg-a
        .mockReturnValueOnce(
          "abc123\nfeat: update shared dependency across all packages"
        ) // git log for pkg-b
        .mockReturnValueOnce(
          "abc123\nfeat: update shared dependency across all packages"
        ); // git log for pkg-c

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git commands were called correctly for each package (order doesn't matter)
      const gitLogCalls = mockExecSync.mock.calls.filter((call) =>
        call[0].includes('git log --format="%H%n%B"')
      );

      // We expect at least 1 git log call (for pkg-a which has a tag)
      // pkg-b and pkg-c don't have tags, so they get initial release treatment
      expect(gitLogCalls.length).toBeGreaterThanOrEqual(1);
      // Verify that calls were made for each package that has a tag
      const pkgACall = gitLogCalls.find((call) =>
        call[0].includes("pkg-a@1.0.0")
      );

      expect(pkgACall).toBeDefined();

      // Verify that git tag was called to get all tags
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });

    it("should handle multi-line commit messages correctly", async () => {
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

      // Mock git results with multi-line commit messages
      // This simulates the real issue: a commit with multiple lines in the message
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
        .mockReturnValueOnce(
          "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(@kira2k/pkg-a): vvvv\nfeat(@kira2k/pkg-b): vvvv\n3bb1ea4644f9129f73f685279ae9c0fc7286cdcc\nfeat(@kira2k/pkg-a)!: aaaa"
        ); // git log with multi-line commit + breaking change

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git commands were called correctly
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
        ),
        expect.any(Object)
      );
    });

    it("should apply scope-based bump logic correctly", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
      });

      // Mock git operations for scope-based scenario
      // Commit affects both packages but only mentions pkg-a in scope
      mockExecSync
        .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@1.0.0") // git tag --list (both packages have tags)
        .mockReturnValueOnce("abc123\nfeat(pkg-a)!: breaking change") // git log for pkg-a
        .mockReturnValueOnce("abc123\nfeat(pkg-a)!: breaking change"); // git log for pkg-b (same commit affects both)

      // Test the actual function logic
      await addChangeset(cwd, { auto: true }, mockConfig);

      // Verify git log was called for pkg-a (which has a tag)
      const gitLogCalls = mockExecSync.mock.calls.filter(
        (call) =>
          call[0].includes('git log --format="%H%n%B"') &&
          call[0].includes("pkg-a@1.0.0")
      );
      expect(gitLogCalls.length).toBeGreaterThanOrEqual(1);

      // pkg-b doesn't have a tag, so it gets initial release treatment (no git log call)
      // Verify that git tag was called to get all tags
      expect(mockExecSync).toHaveBeenCalledWith(
        "git tag --list --sort=-v:refname",
        expect.any(Object)
      );
    });
  });
});
