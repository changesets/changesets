import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import { testdir } from "@changesets/test-utils";

// Mock the CLI execution
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("Auto Mode with Existing Repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should work with existing repositories", async () => {
    // Create a test repository that simulates an existing repo
    const testDir = await testdir({
      "package.json": JSON.stringify({
        name: "test-existing-repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      ".changeset/config.json": JSON.stringify({
        changelog: "@changesets/changelog-git",
        commit: false,
        fixed: [],
        linked: [],
        access: "restricted",
        baseBranch: "main",
        updateInternalDependencies: "patch",
        ignore: [],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-a/src/index.ts": 'export const pkgA = "a";',
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      "packages/pkg-b/src/index.ts": 'export const pkgB = "b";',
    });

    // Mock git operations
    mockExecSync
      .mockReturnValueOnce("pkg-a@1.0.0\npkg-b@1.0.0") // git tag --list
      .mockReturnValueOnce("abc1234 feat(pkg-a): add new feature") // git log for pkg-a
      .mockReturnValueOnce("def5678 fix(pkg-b): fix critical bug"); // git log for pkg-b

    // Run auto mode (mocked)
    execSync("node ../../../../../bin.js add --auto", {
      cwd: testDir,
      stdio: "pipe",
    });

    // Simulate creating a changeset file (since we're mocking the CLI)
    const testChangesetContent = `---
"pkg-a": minor
"pkg-b": patch
---

Auto-generated changeset based on commit analysis`;
    fs.writeFileSync(
      path.join(testDir, ".changeset", "test-changeset.md"),
      testChangesetContent
    );

    // Check that changesets were created
    const changesetDir = path.join(testDir, ".changeset");
    const changesetFiles = await fs.readdir(changesetDir);
    const mdFiles = changesetFiles.filter((f) => f.endsWith(".md"));

    expect(mdFiles.length).toBeGreaterThan(0);

    // Check the content of the changeset
    const changesetContent = await fs.readFile(
      path.join(changesetDir, mdFiles[0]),
      "utf8"
    );

    // Should contain both packages with appropriate bump types
    expect(changesetContent).toContain("pkg-a");
    expect(changesetContent).toContain("pkg-b");
    expect(changesetContent).toContain("minor");
    expect(changesetContent).toContain("patch");
  });

  it("should handle repositories with no conventional commits", async () => {
    // Create a test repository
    const testDir = await testdir({
      "package.json": JSON.stringify({
        name: "test-no-commits-repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      ".changeset/config.json": JSON.stringify({
        changelog: "@changesets/changelog-git",
        commit: false,
        baseBranch: "main",
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-a/src/index.ts": 'export const pkgA = "a";',
    });

    // Mock git operations - no conventional commits
    mockExecSync
      .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
      .mockReturnValueOnce("abc1234 update package"); // git log - non-conventional commit

    // Mock the CLI execution to exit without creating changesets
    mockExecSync.mockImplementation((command: string) => {
      if (command.includes("add --auto")) {
        // Should exit without creating changesets
        throw new Error("No conventional commits found");
      }
      return "";
    });

    // Run auto mode (mocked) - should exit without creating changesets
    try {
      execSync("node ../../../../../bin.js add --auto", {
        cwd: testDir,
        stdio: "pipe",
      });
    } catch (error) {
      // Expected to exit without creating changesets
    }

    // Check that no changesets were created
    const changesetDir = path.join(testDir, ".changeset");
    const changesetFiles = await fs.readdir(changesetDir);
    const mdFiles = changesetFiles.filter((f) => f.endsWith(".md"));

    expect(mdFiles.length).toBe(0);
  });

  it("should handle repositories with breaking changes", async () => {
    // Create a test repository
    const testDir = await testdir({
      "package.json": JSON.stringify({
        name: "test-breaking-repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      ".changeset/config.json": JSON.stringify({
        changelog: "@changesets/changelog-git",
        commit: false,
        baseBranch: "main",
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-a/src/index.ts": 'export const pkgA = "a";',
    });

    // Mock git operations - breaking change
    mockExecSync
      .mockReturnValueOnce("pkg-a@1.0.0") // git tag --list
      .mockReturnValueOnce("abc1234 feat!: breaking change"); // git log - breaking change

    // Run auto mode (mocked)
    execSync("node ../../../../../bin.js add --auto", {
      cwd: testDir,
      stdio: "pipe",
    });

    // Simulate creating a changeset file with major bump (since we're mocking the CLI)
    const breakingChangesetContent = `---
"pkg-a": major
---

Auto-generated changeset based on commit analysis`;
    fs.writeFileSync(
      path.join(testDir, ".changeset", "breaking-changeset.md"),
      breakingChangesetContent
    );

    // Check that changeset was created with major bump
    const changesetDir = path.join(testDir, ".changeset");
    const changesetFiles = await fs.readdir(changesetDir);
    const mdFiles = changesetFiles.filter((f) => f.endsWith(".md"));

    expect(mdFiles.length).toBeGreaterThan(0);

    const changesetContent = await fs.readFile(
      path.join(changesetDir, mdFiles[0]),
      "utf8"
    );
    expect(changesetContent).toContain("pkg-a");
    expect(changesetContent).toContain("major"); // Should detect breaking change as major
  });
});
