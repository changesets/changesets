export default function getVersionRangeType(
  versionRange: string
): "^" | "~" | ">=" | "" {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  if (versionRange.startsWith(">=")) return ">=";
  return "";
}
