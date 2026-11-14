import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { getCommitInfo, getPullRequestInfo } from "@changesets/get-github-info";
import type { ChangelogFunctions } from "@changesets/types";
import { type InferOutput, safeParse } from "valibot";
import { MetadataSchema } from "./metadata.ts";
import { buildReleaseLineTokens, renderTemplate } from "./render-template.ts";
import { mdLink } from "./utils.ts";

const arrayify = <T>(input: T | T[] | null | undefined): T[] | null =>
  input != null ? (Array.isArray(input) ? input : [input]) : null;

const ISSUE_REF_REGEX = /\[.*?\]\(.*?\)|\B#([1-9]\d*)\b/g;

function verifyMetadata(input: unknown): InferOutput<typeof MetadataSchema> {
  const result = safeParse(MetadataSchema, input);
  if (!result.success) {
    const issueLines = result.issues
      .map(
        (issue) =>
          `${issue.path?.map((p) => p.key)?.join(".") || "."}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Received invalid metadata overrides:\n${issueLines}`);
  }

  return result.output;
}

// "match what you skip, capture what you want": the left alternative
// consumes markdown links so the right alternative only matches bare refs
function linkifyIssueRefs(
  line: string,
  { serverUrl, repo }: { serverUrl: string; repo: string },
): string {
  return line.replace(ISSUE_REF_REGEX, (match, issue) =>
    // PRs and issues are the same thing on GitHub (to some extent, of course)
    // this relies on GitHub redirecting from /issues/1234 to /pull/1234 when necessary
    issue ? mdLink(`#${issue}`, `${serverUrl}/${repo}/issues/${issue}`) : match,
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
  const GITHUB_REPOSITORY =
    process.env.GITHUB_REPOSITORY ||
    (await readEnvFileCached()).GITHUB_REPOSITORY;

  return { GITHUB_SERVER_URL, GITHUB_REPOSITORY };
}

async function getRepo(options: null | Record<string, unknown>) {
  let repo: string | undefined;
  if (options && "repo" in options) {
    repo =
      typeof options.repo === "string" && options.repo
        ? options.repo
        : undefined;
  } else {
    repo = (await readEnv()).GITHUB_REPOSITORY;
  }
  if (!repo) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]\nor set the GITHUB_REPOSITORY environment variable.',
    );
  }
  return repo;
}

const changelogFunctions: ChangelogFunctions = {
  getDependencyReleaseLine: async (
    changesets,
    dependenciesUpdated,
    options,
  ) => {
    const repo = await getRepo(options);
    if (dependenciesUpdated.length === 0) return "";

    const changesetLink = `- Updated dependencies [${(
      await Promise.all(
        changesets.map(async (cs) => {
          if (cs.metadata != null) {
            verifyMetadata(cs.metadata);
          }

          if (cs.commit) {
            const info = await getCommitInfo({ commit: cs.commit, repo });
            return info?.commit.markdownLink ?? `\`${cs.commit.slice(0, 7)}\``;
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
  getReleaseLine: async (changeset, _, options) => {
    const metadata =
      changeset.metadata != null ? verifyMetadata(changeset.metadata) : null;

    const repo = await getRepo(options);

    const { GITHUB_SERVER_URL } = await readEnv();

    const [firstLine, ...futureLines] = changeset.summary
      .split("\n")
      .map((l) => l.trimEnd());

    const links: { commit?: string; pull?: string; user?: string } = {
      commit: undefined,
      pull: undefined,
      user: undefined,
    };

    if (metadata?.pr != null) {
      const info = await getPullRequestInfo({ pull: metadata.pr, repo });
      links.commit = info?.commit?.markdownLink;
      links.pull = info?.pull.markdownLink;
      links.user = info?.author?.markdownLink;

      if (metadata?.commit != null) {
        const text = `\`${metadata.commit.slice(0, 7)}\``;
        const url = `${GITHUB_SERVER_URL}/${repo}/commit/${metadata.commit}`;
        links.commit = mdLink(text, url);
      }
    } else if (metadata?.commit || changeset.commit) {
      const commitToFetchFrom = metadata?.commit || changeset.commit!;
      const info = await getCommitInfo({ commit: commitToFetchFrom, repo });
      links.commit = info?.commit.markdownLink;
      links.pull = info?.pull?.markdownLink;
      links.user = info?.author?.markdownLink;
    }

    // ugly, but works...
    const users = arrayify(metadata?.author);
    const usersLinks = users
      ?.map((user) => mdLink(`@${user}`, GITHUB_SERVER_URL, user))
      ?.join(",");
    const usersString =
      options?.disableThanks !== true ? (usersLinks ?? links.user) : null;

    const linkOpts = { serverUrl: GITHUB_SERVER_URL, repo };
    const summaryLinked = linkifyIssueRefs(firstLine, linkOpts);

    const continuation = futureLines
      .map((l) => `  ${linkifyIssueRefs(l, linkOpts)}`)
      .join("\n");

    if (typeof options?.template === "string" && options.template.length > 0) {
      const tokens = buildReleaseLineTokens({
        summaryLinked,
        links,
        users: usersString,
      });
      // trimEnd so an empty trailing token (e.g. `{ref}` with no PR/commit)
      // leaves no dangling space - a trailing space in markdown is unsafe.
      const rendered = renderTemplate(options.template, tokens).trimEnd();
      return `${rendered}\n${continuation}`;
    }

    const prefix = [
      links.pull == null ? "" : ` ${links.pull}`,
      links.commit == null ? "" : ` ${links.commit}`,
      usersString == null ? "" : ` Thanks ${usersString}!`,
    ].join("");

    return `\n\n-${prefix ? `${prefix} -` : ""} ${summaryLinked}\n${continuation}`;
  },
};

// ChangelogFunctions require a default export
export default changelogFunctions;
