import * as v from "valibot";

const OptionsSchema = v.object({
  _: v.optional(v.record(v.string(), v.any())),
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
