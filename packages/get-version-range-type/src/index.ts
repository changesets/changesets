export function getVersionRangeType(
  versionRange: string,
): "^" | "~" | ">=" | "<=" | ">" | "" {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  if (versionRange.startsWith(">=")) return ">=";
  if (versionRange.startsWith("<=")) return "<=";
  if (versionRange.charAt(0) === ">") return ">";
  return "";
}

/** @deprecated Use named export `getVersionRangeType` instead */
const getVersionRangeTypeDefault = getVersionRangeType;
export default getVersionRangeTypeDefault;
