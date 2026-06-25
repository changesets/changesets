// NOTE: the `template` option is experimental and these helpers are intentionally
// not exported from `index.ts`. The token syntax may change in a patch release.

const TOKEN_REGEX = /\{(\w+)\}/g;

export const RELEASE_LINE_TOKENS = [
  "summary",
  "ref",
  "pull",
  "commit",
  "authors",
] as const;

export function renderTemplate(
  template: string,
  tokens: Record<string, string>,
): string {
  return template.replace(TOKEN_REGEX, (_match, name: string) => {
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
  summaryLinked: string;
  links: { pull: string | null; commit: string | null; user: string | null };
  users: string | null;
}): Record<string, string> {
  const { summaryLinked, links, users } = args;
  // Tokens render bare (no built-in spacing); the template author writes the
  // spaces. `{ref}` is the one self-contained convenience: a parenthesized
  // PR-or-commit reference (PR wins), empty when there is neither.
  const ref = links.pull
    ? `(${links.pull})`
    : links.commit
      ? `(${links.commit})`
      : "";
  return {
    summary: summaryLinked,
    ref,
    pull: links.pull ?? "",
    commit: links.commit ?? "",
    authors: users ?? "",
  };
}
