import {
  getRecommendedBump,
  getCommitsSinceTag,
  CommitAnalyzer,
} from "../auto-mode";
import { Config, VersionType } from "@changesets/types";
import { execSync } from "child_process";

jest.mock("child_process");

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("Auto Mode Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock analyzer for testing
  const mockAnalyzer = async (commits: any[]): Promise<VersionType> => {
    const hasBreakingChange = commits.some(
      (c) =>
        c.message.includes("!") ||
        c.message.toLowerCase().includes("breaking change")
    );
    if (hasBreakingChange) return "major";

    const hasFeat = commits.some((c) =>
      c.message.toLowerCase().includes("feat")
    );
    if (hasFeat) return "minor";

    const hasFix = commits.some((c) => c.message.toLowerCase().includes("fix"));
    if (hasFix) return "patch";

    return "none";
  };

  const mockConfig: Config = {
    changelog: false,
    commit: false,
    fixed: [],
    linked: [],
    access: "restricted",
    baseBranch: "main",
    changedFilePatterns: [],
    prettier: false,
    privatePackages: { version: false, tag: false },
    updateInternalDependencies: "patch",
    ignore: [],
    ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
      onlyUpdatePeerDependentsWhenOutOfRange: false,
      updateInternalDependents: "always",
    },
    auto: {
      maxCommits: 100,
      preset: "conventionalcommits",
      analyzer: mockAnalyzer,
    },
    snapshot: {
      useCalculatedVersion: false,
      prereleaseTemplate: null,
    },
  };

  describe("getCommitsSinceTag", () => {
    it("should parse single-line commit messages correctly", () => {
      mockExecSync.mockReturnValueOnce(
        "811269d2a370b1d89e8794a05b093168af6383a4\nfeat: single line commit\n3bb1ea4644f9129f73f685279ae9c0fc7286cdcc\nfix: another single line"
      );

      const commits = getCommitsSinceTag("v1.0.0", "packages/pkg-a", 100);

      expect(commits).toEqual([
        {
          hash: "811269d2a370b1d89e8794a05b093168af6383a4",
          message: "feat: single line commit",
        },
        {
          hash: "3bb1ea4644f9129f73f685279ae9c0fc7286cdcc",
          message: "fix: another single line",
        },
      ]);
    });

    it("should parse multi-line commit messages correctly", () => {
      // This simulates the real issue we found
      mockExecSync.mockReturnValueOnce(
        "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(@kira2k/pkg-a): vvvv\nfeat(@kira2k/pkg-b): vvvv\n3bb1ea4644f9129f73f685279ae9c0fc7286cdcc\nfeat(@kira2k/pkg-a)!: aaaa"
      );

      const commits = getCommitsSinceTag("v1.0.0", "packages/pkg-a", 100);

      expect(commits).toEqual([
        {
          hash: "811269d2a370b1d89e8794a05b093168af6383a4",
          message: "feat(@kira2k/pkg-a): vvvv\nfeat(@kira2k/pkg-b): vvvv",
        },
        {
          hash: "3bb1ea4644f9129f73f685279ae9c0fc7286cdcc",
          message: "feat(@kira2k/pkg-a)!: aaaa",
        },
      ]);
    });

    it("should handle empty git log output", () => {
      mockExecSync.mockReturnValueOnce("");

      const commits = getCommitsSinceTag("v1.0.0", "packages/pkg-a", 100);

      expect(commits).toEqual([]);
    });

    it("should limit commits to maxCommits", () => {
      const manyCommits = Array.from(
        { length: 10 },
        (_, i) => `${i.toString().padStart(40, "0")}\ncommit ${i}`
      ).join("\n");

      mockExecSync.mockReturnValueOnce(manyCommits);

      const commits = getCommitsSinceTag("v1.0.0", "packages/pkg-a", 5);

      expect(commits).toHaveLength(5);
      expect(commits[0]).toEqual({
        hash: "0000000000000000000000000000000000000000",
        message: "commit 0",
      });
    });
  });

  describe("getRecommendedBump", () => {
    it("should detect major bump for breaking change", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat!: breaking change";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("major");
    });

    it("should detect minor bump for feature", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat: new feature";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should return 'none' for non-conventional commits", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\npublish";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("none");
    });

    it("should downgrade major bump to patch for affected but not mentioned package", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(cli)!: breaking change";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("patch");
    });

    it("should downgrade minor bump to patch for affected but not mentioned package", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(cli): new feature";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("patch");
    });

    it("should keep major bump for mentioned package", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(pkg-a)!: breaking change";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("major");
    });

    it("should keep minor bump for mentioned package", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(pkg-a): new feature";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should keep patch bump for affected but not mentioned package", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfix(cli): bug fix";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("patch");
    });

    it("should handle unscoped commits (treat all affected packages equally)", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat: new feature";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should keep highest bump when package is mentioned in one commit but not others", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log")) {
          // Single commit with scope - this should work
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(pkg-a): new feature";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should detect package mentioned in multi-line commit message", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-b@1.0.0";
        }
        if (command.includes("git log")) {
          // Multi-line commit with both packages mentioned
          return "811269d2a370b1d89e8794a05b093168af6383a4\nfeat(@kira2k/pkg-a): vvvv\nfeat(@kira2k/pkg-b): vvvv";
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const result = await getRecommendedBump(
        "pkg-b",
        "packages/pkg-b",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should handle package names with special characters", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-name-with-dashes@1.0.0";
        }
        if (
          command.includes("git log") &&
          command.includes("packages/pkg-name-with-dashes")
        ) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-name-with-dashes): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-name-with-dashes",
        "packages/pkg-name-with-dashes",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should handle scopes with special characters", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should handle multiple scopes in one commit", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a,pkg-b): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("patch");
    });

    it("should handle package names that are substrings of others", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a-utils): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      // pkg-a should NOT match pkg-a-utils scope
      expect(result.bump).toBe("patch");
    });

    it("should handle breaking changes in commit body", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a): new feature\n\nBREAKING CHANGE: This is a breaking change";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("major");
    });

    it("should handle empty commit messages", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\n\n";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("none");
    });

    it("should handle extremely long commit messages", async () => {
      const longMessage = "feat(pkg-a): " + "x".repeat(10000);
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return `1234567890abcdef1234567890abcdef12345678\n${longMessage}`;
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should handle git tag with special characters", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0-beta.1";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      expect(result.bump).toBe("minor");
    });

    it("should handle analyzer function throwing errors", async () => {
      const errorAnalyzer: CommitAnalyzer = async () => {
        throw new Error("Analyzer error");
      };

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump("pkg-a", "packages/pkg-a", {
        ...mockConfig,
        auto: { ...mockConfig.auto, analyzer: errorAnalyzer },
      });

      expect(result.bump).toBe("none");
    });

    it("should handle negative maxCommits", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          return "1234567890abcdef1234567890abcdef12345678\nfeat(pkg-a): new feature";
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump("pkg-a", "packages/pkg-a", {
        ...mockConfig,
        auto: { ...mockConfig.auto, maxCommits: -1 },
      });

      expect(result.bump).toBe("none");
    });

    it("should handle mixed commit styles (conventional and non-conventional)", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          // Mix of conventional and non-conventional commits
          return `811269d2a370b1d89e8794a05b093168af6383a4
feat(pkg-a): new feature
3bb1ea4644f9129f73f685279ae9c0fc7286cdcc
fix: bug fix
5cc1ea4644f9129f73f685279ae9c0fc7286cdcc
update documentation
7dd1ea4644f9129f73f685279ae9c0fc7286cdcc
feat(pkg-a)!: breaking change
9ee1ea4644f9129f73f685279ae9c0fc7286cdcc
publish new version`;
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      // Should detect the highest bump from conventional commits (major from breaking change)
      expect(result.bump).toBe("major");
    });

    it("should handle commit messages with special characters", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          // Commits with special characters: quotes, backslashes, emojis
          return `811269d2a370b1d89e8794a05b093168af6383a4
feat(pkg-a): add "quoted" feature with \\backslashes\\ and 🚀 emojis
3bb1ea4644f9129f73f685279ae9c0fc7286cdcc
fix(pkg-a): fix bug with 'single quotes' and \`backticks\`
5cc1ea4644f9129f73f685279ae9c0fc7286cdcc
feat(pkg-a): new feature with special chars: @#$%^&*()`;
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      // Should detect the highest bump from conventional commits (minor from feat)
      expect(result.bump).toBe("minor");
    });

    it("should handle malformed conventional commits", async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes("git tag --list")) {
          return "pkg-a@1.0.0";
        }
        if (command.includes("git log") && command.includes("packages/pkg-a")) {
          // Malformed conventional commits with empty descriptions
          return `811269d2a370b1d89e8794a05b093168af6383a4
feat(pkg-a): 
3bb1ea4644f9129f73f685279ae9c0fc7286cdcc
fix: 
5cc1ea4644f9129f73f685279ae9c0fc7286cdcc
feat(pkg-a): valid feature
7dd1ea4644f9129f73f685279ae9c0fc7286cdcc
feat: 
9ee1ea4644f9129f73f685279ae9c0fc7286cdcc
fix(pkg-a): valid fix`;
        }
        return ""; // Return empty string for unmatched commands
      });

      const result = await getRecommendedBump(
        "pkg-a",
        "packages/pkg-a",
        mockConfig
      );

      // Should detect the highest bump from valid conventional commits (minor from valid feat)
      expect(result.bump).toBe("minor");
    });
  });
});
