export function mdLink(text: string, ...urlParts: string[]) {
  const url = urlParts
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .join("/");

  return `[${text}](${url})`;
}
