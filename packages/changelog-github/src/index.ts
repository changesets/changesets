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

// narrow autolinking (exposed to composers as `linkHints`): only links a ref
// that sits inside `(fix #123)`, `(fixes #123)`, or `(see #123)`
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

export interface ReleaseLineParts {
  /** First line of the changeset summary, raw (not linkified). */
  summary: string;
  /** Markdown PR link, or "" when there is none. */
  pr: string;
  /** Markdown commit link, or "" when there is none. */
  commit: string;
  /** Markdown author links; empty when there is no attribution. */
  authors: string[];
  /** Links every bare `#123` in the given string (the default behavior). */
  linkRefs: (line: string) => string;
  /** Links only refs inside `(fix|fixes|see #123)`. */
  linkHints: (line: string) => string;
}

export type ReleaseLineResult = string | { separator?: string; line: string };

export type ReleaseLineComposer = (
  parts: ReleaseLineParts,
) => ReleaseLineResult;

// Reproduces the historical default line, byte-for-byte:
//   - {pr} {commit} Thanks {authors}! - {summary}
const defaultReleaseLine: ReleaseLineComposer = ({
  summary,
  pr,
  commit,
  authors,
  linkRefs,
}) => {
  const prefix = [
    pr ? ` ${pr}` : "",
    commit ? ` ${commit}` : "",
    authors.length ? ` Thanks ${authors.join(", ")}!` : "",
  ].join("");
  return `-${prefix ? `${prefix} -` : ""} ${linkRefs(summary)}`;
};

export function composeReleaseLine(
  compose: ReleaseLineComposer,
): ChangelogFunctions["getReleaseLine"] {
  return async (changeset, _type, options) => {
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
        const { links } = await getInfo({ repo, commit: commitToFetchFrom });
        return links;
      }
      return { commit: null, pull: null, user: null };
    })();

    const linkOpts = { serverUrl: GITHUB_SERVER_URL, repo };
    const linkRefs = (line: string) => linkifyIssueRefs(line, linkOpts);
    const linkHints = (line: string) => linkifyIssueHints(line, linkOpts);

    const authors = usersFromSummary.length
      ? usersFromSummary.map(
          (user) => `[@${user}](${GITHUB_SERVER_URL}/${user})`,
        )
      : links.user
        ? [links.user]
        : [];

    const result = compose({
      summary: firstLine,
      pr: links.pull ?? "",
      commit: links.commit ?? "",
      authors,
      linkRefs,
      linkHints,
    });

    const { separator, line } =
      typeof result === "string"
        ? { separator: "\n\n", line: result }
        : { separator: result.separator ?? "\n\n", line: result.line };

    const continuation =
      "\n" + futureLines.map((l) => `  ${linkRefs(l)}`).join("\n");

    return `${separator}${line}${continuation}`;
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
  getReleaseLine: composeReleaseLine(defaultReleaseLine),
};

// ChangelogFunctions require a default export
export default changelogFunctions;
