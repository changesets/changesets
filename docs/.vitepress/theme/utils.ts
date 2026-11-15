export function extractBlogData(src: string, url: string) {
  const title = /^#\s+(.+)$/m.exec(src)?.[1];
  if (!title) throw new Error(`Missing title in blog post at ${url}`);

  const date = /^_(.+)_$/m.exec(src)?.[1];
  if (!date) throw new Error(`Missing date in blog post at ${url}`);

  return { title, date };
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-UK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
