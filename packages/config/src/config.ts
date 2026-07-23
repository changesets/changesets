import type { Config } from "@changesets/types";
import * as v from "valibot";
import { type ValidationContext, globMatch } from "./utils.ts";

const rootKey = <Schema extends v.BaseSchema<any, any, any>>(
  schema: Schema,
  description?: string,
  defaultValue?: v.InferInput<Schema>,
) =>
  v.optional(
    description != null ? v.pipe(schema, v.description(description)) : schema,
    defaultValue,
  );

const PackageGroupSchema = v.pipe(
  v.array(v.array(v.string())),
  v.examples([
    [
      ["@pkg/a", "@pkg/b"],
      ["@pkg/d", "@pkg/e"],
    ],
  ]),
);

const ChangelogSchema = v.union(
  [
    v.literal(false),
    v.string(),
    v.tuple([v.string(), v.nullable(v.record(v.string(), v.unknown()))]),
  ],
  'Invalid type: Expected false, a module path ("@changesets/cli/changelog" or "./some-module"), or a tuple of module path and options (["@changesets/cli/changelog", { "someOption": true }]).',
);

const CommitSchema = v.union(
  [
    v.boolean(),
    v.string(),
    v.tuple([v.string(), v.nullable(v.record(v.string(), v.unknown()))]),
  ],
  'Invalid type: Expected a boolean, a module path (e.g. "@changesets/cli/commit" or "./some-module"), or a tuple with a module path and options (e.g. ["@changesets/cli/commit", { "skipCI": "version" }])]',
);

const AccessSchema = v.union([v.literal("public"), v.literal("restricted")]);

export const WrittenConfigSchema = v.object({
  baseBranch: rootKey(
    v.string(),
    "Determines the branch that Changesets uses when finding what packages have changed.",
    "main",
  ),
  // add changeset about removing support for alias `private` (`restricted`)
  access: rootKey(
    AccessSchema,
    "Determines whether Changesets should publish packages to the registry publicly or to a restricted scope.",
    "restricted",
  ),
  changedFilePatterns: rootKey(
    v.array(v.string()),
    "A list of file patterns that Changesets should consider when determining what packages have changed.",
    ["**"],
  ),
  format: rootKey(
    v.union([
      v.literal("auto"),
      v.literal("prettier"),
      v.literal("oxfmt"),
      v.literal("deno"),
      v.literal("dprint"),
      v.literal(false),
    ]),
    "The formatter to use to format changesets and changelogs. Set `false` to disable formatting. The default value of `auto` will auto-detect the formatter based on the project's configuration files.",
    "auto",
  ),

  ignore: rootKey(
    v.array(v.string()),
    "Packages that should not be released.",
    [],
  ),
  fixed: rootKey(
    PackageGroupSchema,
    "Packages that should always be released together with the same version.",
    [],
  ),
  linked: rootKey(
    PackageGroupSchema,
    "Packages that should be linked together so when they are being released, they will be released at the same version.",
    [],
  ),
  updateInternalDependencies: rootKey(
    v.union([v.literal("minor"), v.literal("patch")]),
    "The minimum bump type to trigger automatic update of internal dependencies that are part of the same release.",
    "patch",
  ),
  privatePackages: rootKey(
    v.union([
      v.object({
        version: v.optional(v.boolean(), true),
        tag: v.optional(v.boolean(), false),
      }),
      v.literal(false),
    ]),
    "Opt in to tracking non-npm / private packages",
    {},
  ),
  stagedPublishing: rootKey(
    v.boolean(),
    "Stages packages for approval instead of publishing them immediately.",
    false,
  ),
  bumpVersionsWithWorkspaceProtocolOnly: rootKey(
    v.boolean(),
    "Determines whether Changesets should only bump dependency ranges that use workspace protocol of packages that are part of the workspace.",
    false,
  ),
  snapshot: rootKey(
    v.object({
      useCalculatedVersion: v.optional(
        v.pipe(
          v.boolean(),
          v.description(
            "Makes generated snapshot versions use the calculated version (based on the changeset files) as a base version, instead of 0.0.0",
          ),
        ),
        false,
      ),
      prereleaseTemplate: v.optional(
        v.pipe(
          v.string(),
          v.minLength(1),
          v.description(
            "A template for the prerelease (suffix) part of the generated snapshot version. The template can use the following variable patterns: {commit}, {tag}, {datetime}, {timestamp}.",
          ),
        ),
      ),
    }),
    "Snapshot-specific options.",
    {},
  ),

  // Generators
  changelog: rootKey(
    ChangelogSchema,
    "The configuration for changelog generators.",
    "@changesets/cli/changelog",
  ),
  commit: rootKey(
    CommitSchema,
    "Determines whether Changesets should commit the results of the add and version command.",
    false,
  ),

  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: rootKey(
    v.object({
      onlyUpdatePeerDependentsWhenOutOfRange: v.optional(v.boolean(), false),
      updateInternalDependents: v.optional(
        v.union([v.literal("always"), v.literal("out-of-range")]),
        "out-of-range",
      ),
    }),
    "Unsafe options",
    {},
  ),
});

/**
 * "Normalizes" a `WrittenConfig` into a `Config`, by filling in defaults and
 * rewriting properties with multiple forms into a single one.
 */
export function normalizeWrittenConfig({
  packageNames,
  writtenConfig,
}: Pick<ValidationContext, "packageNames" | "writtenConfig">): Config {
  const config = structuredClone(writtenConfig) as Config;

  if (typeof writtenConfig.changelog === "string") {
    config.changelog = [writtenConfig.changelog, null];
  }

  if (typeof writtenConfig.commit === "string") {
    config.commit = [writtenConfig.commit, null];
  } else if (writtenConfig.commit === true) {
    config.commit = ["@changesets/cli/commit", { skipCI: "version" }];
  }

  if (writtenConfig.ignore != null) {
    config.ignore = globMatch(packageNames, writtenConfig.ignore);
  }

  // TODO consider enabling this by default in the next major version
  // might be more context in here: https://github.com/changesets/changesets/pull/662
  if (typeof writtenConfig.privatePackages !== "object") {
    config.privatePackages = {
      version: writtenConfig.privatePackages ?? true,
      tag: false,
    };
  } else {
    config.privatePackages = {
      version: writtenConfig.privatePackages.version ?? true,
      tag: writtenConfig.privatePackages.tag ?? false,
    };
  }

  return config;
}
