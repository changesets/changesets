import { testdir } from "@changesets/test-utils";
import { execSync } from "child_process";
import addChangeset from "../index";
import { CommitAnalyzer } from "../auto-mode";
import { defaultConfig } from "@changesets/config";

jest.mock("child_process");

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("Multi-Package Commit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock analyzer for testing
  const mockAnalyzer: CommitAnalyzer = async (commits) => {
    // Check for breaking changes first
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

  it("should handle commit affecting multiple packages", async () => {
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
      .mockReturnValueOnce("abc123\nfeat: update shared dependency") // git log for pkg-a
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0\npkg-c@3.0.0") // git tag --list (for pkg-b)
      .mockReturnValueOnce("abc123\nfeat: update shared dependency") // git log for pkg-b
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0\npkg-c@3.0.0") // git tag --list (for pkg-c)
      .mockReturnValueOnce("abc123\nfeat: update shared dependency"); // git log for pkg-c

    // Test the actual function logic
    await addChangeset(cwd, { auto: true }, mockConfig);

    // Verify git commands were called correctly for each package
    expect(mockExecSync).toHaveBeenCalledWith(
      "git tag --list --sort=-v:refname",
      expect.any(Object)
    );

    // Should be called for each package that has commits
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(
        /git log --format="%H%n%B" pkg-a@1\.0\.0\.\.HEAD -- .*/
      ),
      expect.any(Object)
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(
        /git log --format="%H%n%B" pkg-b@2\.0\.0\.\.HEAD -- .*/
      ),
      expect.any(Object)
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(
        /git log --format="%H%n%B" pkg-c@3\.0\.0\.\.HEAD -- .*/
      ),
      expect.any(Object)
    );
  });

  it("should handle breaking change affecting multiple packages", async () => {
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

    // Mock git results for a breaking change that affects multiple packages
    mockExecSync
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0") // git tag --list
      .mockReturnValueOnce("abc123\nfeat!: breaking change in shared API") // git log for pkg-a
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0") // git tag --list (for pkg-b)
      .mockReturnValueOnce("abc123\nfeat!: breaking change in shared API"); // git log for pkg-b

    // Test the actual function logic
    await addChangeset(cwd, { auto: true }, mockConfig);

    // Verify git commands were called correctly
    expect(mockExecSync).toHaveBeenCalled();
  });

  it("should handle mixed commit types affecting multiple packages", async () => {
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

    // Mock git results for different commit types affecting different packages
    mockExecSync
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0") // git tag --list
      .mockReturnValueOnce("abc123\nfeat: new feature for pkg-a") // git log for pkg-a
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@2.0.0") // git tag --list (for pkg-b)
      .mockReturnValueOnce("def456\nfix: bug fix for pkg-b"); // git log for pkg-b

    // Test the actual function logic
    await addChangeset(cwd, { auto: true }, mockConfig);

    // Verify git commands were called correctly
    expect(mockExecSync).toHaveBeenCalled();
  });
});
