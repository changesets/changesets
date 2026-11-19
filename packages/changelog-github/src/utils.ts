export function trimSlashes(str: string): string {
  let start = 0;
  let end = str.length;

  while (start < end && str.charCodeAt(start) === 47 /*/*/) start++;
  while (end > start && str.charCodeAt(end - 1) === 47 /*/*/) end--;

  return str.slice(start, end);
}

export function mdLink(text: string, ...urlParts: string[]): string {
  const url = urlParts.map(trimSlashes).join("/");

  return `[${text}](${url})`;
}
