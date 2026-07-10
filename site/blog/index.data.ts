import { createContentLoader } from "vitepress";

interface Post {
  title: string;
  url: string;
  date: {
    time: number;
    iso: string;
    string: string;
  };
}

declare const data: Post[];
export { data };

export default createContentLoader("blog/*.md", {
  transform(raw): Post[] {
    return raw
      .filter(({ url }) => url !== "/blog/")
      .map(({ url, frontmatter }) => ({
        title: frontmatter.title,
        url,
        date: formatDate(frontmatter.date),
      }))
      .sort((a, b) => b.date.time - a.date.time);
  },
});

function formatDate(raw: string): Post["date"] {
  const date = new Date(raw);
  date.setUTCHours(12);
  return {
    time: +date,
    iso: date.toISOString(),
    string: date.toLocaleDateString("en-UK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}
