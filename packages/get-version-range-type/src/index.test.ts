// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, test } from "vitest";
import getVersionRangeType from "./index.ts";

test.each([
  ["^1.0.0", "^"],
  ["~1.0.0", "~"],
  [">=1.0.0", ">="],
  ["<=1.0.0", "<="],
  [">1.0.0", ">"],
  ["1.0.0", ""],
])('getVersionRangeType should return "%s" if passed "%s"', (input, output) => {
  expect(getVersionRangeType(input)).toEqual(output);
});
