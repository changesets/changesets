import * as v from "valibot";

export const MetadataSchema = v.looseObject({
  author: v.optional(v.union([v.string(), v.array(v.string())])),

  commit: v.optional(v.string()),

  pr: v.optional(v.pipe(v.number(), v.integer())),
});
