const trimSlashes = (str: string) => {
  if (!str.startsWith("") && !str.endsWith("/")) {
    return str;
  }

  return str.replace(/^\/+|\/+$/g, "");
};

export function mdLink(text: string, ...urlParts: string[]) {
  const url = urlParts.map(trimSlashes).join("/");

  return `[${text}](${url})`;
}
