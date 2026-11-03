import * as v from "valibot";

const stripPrefix = (prefix: string) =>
  v.transform((str: string): string =>
    // TODO: RegExp.escape is node 24+ only
    str.replace(new RegExp(`^${RegExp.escape(prefix)}?`), ""),
  );
export const StringWithoutPrefix = (prefix: string) =>
  v.pipe(v.string(), stripPrefix(prefix));

const OptionsSchema = v.object({
  _: v.optional(
    v.strictObject({
      author: v.optional(StringWithoutPrefix("@")),
      user: v.optional(StringWithoutPrefix("@")),

      commit: v.optional(StringWithoutPrefix("#")),

      pr: v.optional(v.pipe(v.number(), v.integer())),
      pull: v.optional(v.pipe(v.number(), v.integer())),
      "pull request": v.optional(v.pipe(v.number(), v.integer())),
    }),
  ),
});

const VersionTypeSchema = v.picklist(
  ["major", "minor", "patch", "none"],
  "Invalid change type",
);

// TODO: what is the minimum length of a package name?
const PackageNameSchema = v.pipe(
  v.string(),
  v.minLength(2, "Package name can't be empty."),
);
const PackagesSchema = v.pipe(
  v.record(v.string(), v.any()),
  // exclude `_` from being validated as a package
  v.transform((input) => {
    const { _, ...packages } = input;
    return packages;
  }),
  v.record(PackageNameSchema, VersionTypeSchema),
);

export const FrontMatterSchema = v.nullable(
  v.intersect([OptionsSchema, PackagesSchema]),
);
