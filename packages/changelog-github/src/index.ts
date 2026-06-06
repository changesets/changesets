import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { getInfo, getInfoFromPullRequest } from "@changesets/get-github-info";
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

// narrow autolinking used by `autolinkIssues: "hints"`: only links a ref that
// sits inside `(fix #123)`, `(fixes #123)`, or `(see #123)`
function linkifyIssueHints(
  line: string,
  { serverUrl, repo }: { serverUrl: string; repo: string },
): string {
  return line.replace(
    /(?<=\( ?(?:fix|fixes|see) )#(\d+)(?= ?\))/g,
    (_match, issue) => `[#${issue}](${serverUrl}/${repo}/issues/${issue})`,
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

export const RELEASE_LINE_TOKENS = [
  "summary",
  "ref",
  "pr",
  "commit",
  "authors",
] as const;

export function renderTemplate(
  template: string,
  tokens: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!Object.hasOwn(tokens, name)) {
      throw new Error(
        `Unknown changelog template token "{${name}}". Valid tokens are: ${RELEASE_LINE_TOKENS.map(
          (t) => `{${t}}`,
        ).join(", ")}.`,
      );
    }
    return tokens[name];
  });
}

export function buildReleaseLineTokens(args: {
  summary: string;
  links: { pull: string | null; commit: string | null; user: string | null };
  users: string | null;
}): Record<string, string> {
  const { summary, links, users } = args;
  // Tokens render bare (no built-in spacing); the template author writes the
  // spaces. `{ref}` is the one self-contained convenience: a parenthesized
  // PR-or-commit reference (PR wins), empty when there is neither.
  const ref = links.pull
    ? `(${links.pull})`
    : links.commit
      ? `(${links.commit})`
      : "";
  return {
    summary,
    ref,
    pr: links.pull ?? "",
    commit: links.commit ?? "",
    authors: users ?? "",
  };
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
            const { links } = await getInfo({
              repo,
              commit: cs.commit,
            });
            return links.commit;
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

    const links = await (async () => {
      if (prFromSummary != null) {
        let { links } = await getInfoFromPullRequest({
          repo,
          pull: prFromSummary,
        });
        if (commitFromSummary) {
          const shortCommitId = commitFromSummary.slice(0, 7);
          links = {
            ...links,
            commit: `[\`${shortCommitId}\`](${GITHUB_SERVER_URL}/${repo}/commit/${commitFromSummary})`,
          };
        }
        return links;
      }
      const commitToFetchFrom = commitFromSummary || changeset.commit;
      if (commitToFetchFrom) {
        const { links } = await getInfo({
          repo,
          commit: commitToFetchFrom,
        });
        return links;
      }
      return {
        commit: null,
        pull: null,
        user: null,
      };
    })();

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

    const autolink = (line: string): string => {
      const linkOpts = { serverUrl: GITHUB_SERVER_URL, repo };
      return options.autolinkIssues === "hints"
        ? linkifyIssueHints(line, linkOpts)
        : linkifyIssueRefs(line, linkOpts);
    };

    const continuation = futureLines.map((l) => `  ${autolink(l)}`).join("\n");

    if (typeof options.template === "string" && options.template.length > 0) {
      const tokens = buildReleaseLineTokens({
        summary: autolink(firstLine),
        links,
        users,
      });
      // trimEnd so an empty trailing token (e.g. `{ref}` with no PR/commit)
      // leaves no dangling space - a trailing space in markdown is unsafe.
      const rendered = renderTemplate(options.template, tokens).trimEnd();
      return `${rendered}\n${continuation}`;
    }

    const prefix = [
      links.pull == null ? "" : ` ${links.pull}`,
      links.commit == null ? "" : ` ${links.commit}`,
      users == null ? "" : ` Thanks ${users}!`,
    ].join("");

    return `\n\n-${prefix ? `${prefix} -` : ""} ${autolink(firstLine)}\n${continuation}`;
  },
};

// ChangelogFunctions require a default export
export default changelogFunctions;
