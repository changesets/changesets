export default function versionRangeToRangeType(
  versionRange: string
): "^" | "~" | "" {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  return "";
}
