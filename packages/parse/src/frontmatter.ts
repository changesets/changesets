import * as v from "valibot";
import { escapeRegExp } from "./regexp-escape.ts";

const stripPrefix = (prefix: string) =>
  v.transform((str: string): string =>
    str.replace(new RegExp(`^${escapeRegExp(prefix)}?`), ""),
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
  "Invalid change type (valid ones are major, minor, patch, none)",
);

const PackageNameSchema = v.pipe(
  v.string(),
  v.nonEmpty("Package name can't be empty."),
  v.maxLength(214, "Package name can't exceed 214 characters."),
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
