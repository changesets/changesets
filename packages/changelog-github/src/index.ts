import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { getCommitInfo, getPullRequestInfo } from "@changesets/get-github-info";
import type { ChangelogFunctions } from "@changesets/types";

// "match what you skip, capture what you want": the left alternative
// consumes markdown links so the right alternative only matches bare refs
function linkifyIssueRefs(
  line: string,
  { serverUrl, repo }: { serverUrl: string; repo: string },
): string {
  return line.replace(/\[.*?\]\(.*?\)|\B#([1-9]\d*)\b/g, (match, issue) =>
    // PRs and issues are the same thing on GitHub (to some extent, of course)
    // this relies on GitHub redirecting from /issues/1234 to /pull/1234 when necessary
    issue ? `[#${issue}](${serverUrl}/${repo}/issues/${issue})` : match,
  );
}

async function readEnvFile() {
  const envFile = path.resolve(process.cwd(), ".env");
  let content: string | undefined;
  try {
    content = await fs.readFile(envFile, "utf-8");
  } catch {
    return {};
  }
  return util.parseEnv(content);
}

let cachedEnv: ReturnType<typeof readEnvFile> | undefined;
function readEnvFileCached() {
  cachedEnv ??= readEnvFile();
  return cachedEnv;
}

async function readEnv() {
  const GITHUB_SERVER_URL =
    process.env.GITHUB_SERVER_URL ||
    (await readEnvFileCached()).GITHUB_SERVER_URL ||
    "https://github.com";
  return { GITHUB_SERVER_URL };
}

const changelogFunctions: ChangelogFunctions = {
  getDependencyReleaseLine: async (
    changesets,
    dependenciesUpdated,
    options,
  ) => {
    const repo = options?.repo;
    if (!repo || typeof repo !== "string") {
      throw new Error(
        'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
      );
    }
    if (dependenciesUpdated.length === 0) return "";

    const changesetLink = `- Updated dependencies [${(
      await Promise.all(
        changesets.map(async (cs) => {
          if (cs.commit) {
            const info = await getCommitInfo({ commit: cs.commit, repo });
            if (info != null) {
              return `[\`${info.commit.sha.slice(0, 7)}\`](${info.commit.url})`;
            } else {
              return `\`${cs.commit.slice(0, 7)}\``;
            }
          }
        }),
      )
    )
      .filter((_) => _)
      .join(", ")}]:`;

    const updatedDepenenciesList = dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
    );

    return [changesetLink, ...updatedDepenenciesList].join("\n");
  },
  getReleaseLine: async (changeset, type, options) => {
    const repo = options?.repo;
    if (!repo || typeof repo !== "string") {
      throw new Error(
        'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
      );
    }

    const { GITHUB_SERVER_URL } = await readEnv();

    let prFromSummary: number | undefined;
    let commitFromSummary: string | undefined;
    const usersFromSummary: string[] = [];

    const replacedChangelog = changeset.summary
      .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
        const num = Number(pr);
        if (!isNaN(num)) prFromSummary = num;
        return "";
      })
      .replace(/^\s*commit:\s*([^\s]+)/im, (_, commit) => {
        commitFromSummary = commit;
        return "";
      })
      .replace(/^\s*(?:author|user):\s*@?([^\s]+)/gim, (_, user) => {
        usersFromSummary.push(user);
        return "";
      })
      .trim();

    const [firstLine, ...futureLines] = replacedChangelog
      .split("\n")
      .map((l) => l.trimEnd());

    const links: { commit?: string; pull?: string; user?: string } = {
      commit: undefined,
      pull: undefined,
      user: undefined,
    };

    if (prFromSummary != null) {
      const info = await getPullRequestInfo({
        pull: prFromSummary,
        repo,
      });
      if (commitFromSummary) {
        links.commit = `[\`${commitFromSummary.slice(0, 7)}\`](${GITHUB_SERVER_URL}/${repo}/commit/${commitFromSummary})`;
      } else if (info?.commit) {
        links.commit = `[\`${info.commit.sha.slice(0, 7)}\`](${info.commit.url})`;
      }
      if (info?.pull) {
        links.pull = `[#${info.pull.number}](${info.pull.url})`;
      }
      if (info?.author) {
        links.user = `[@${info.author.login}](${info.author.url})`;
      }
    } else if (commitFromSummary || changeset.commit) {
      const info = await getCommitInfo({
        commit: commitFromSummary || changeset.commit!,
        repo,
      });
      if (info?.commit) {
        links.commit = `[\`${info.commit.sha.slice(0, 7)}\`](${info.commit.url})`;
      }
      if (info?.pull) {
        links.pull = `[#${info.pull.number}](${info.pull.url})`;
      }
    }

    const users = options.disableThanks
      ? null
      : usersFromSummary.length
        ? usersFromSummary
            .map(
              (userFromSummary) =>
                `[@${userFromSummary}](${GITHUB_SERVER_URL}/${userFromSummary})`,
            )
            .join(", ")
        : links.user;

    const prefix = [
      links.pull == null ? "" : ` ${links.pull}`,
      links.commit == null ? "" : ` ${links.commit}`,
      users == null ? "" : ` Thanks ${users}!`,
    ].join("");

    return `\n\n-${prefix ? `${prefix} -` : ""} ${linkifyIssueRefs(firstLine, {
      serverUrl: GITHUB_SERVER_URL,
      repo,
    })}\n${futureLines
      .map(
        (l) =>
          `  ${linkifyIssueRefs(l, {
            serverUrl: GITHUB_SERVER_URL,
            repo,
          })}`,
      )
      .join("\n")}`;
  },
};

// ChangelogFunctions require a default export
export default changelogFunctions;
