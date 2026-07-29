import { createContentLoader } from "vitepress";
import { extractBlogData } from "../.vitepress/theme/utils.ts";

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
  includeSrc: true,
  transform(contents): Post[] {
    return contents
      .filter(({ url }) => url !== "/blog/")
      .map(({ url, src }) => {
        const { title, date } = extractBlogData(src!, url);
        const dateObj = new Date(date);
        return {
          title,
          url,
          date: {
            time: +dateObj,
            iso: dateObj.toISOString(),
            string: date,
          },
        };
      })
      .sort((a, b) => b.date.time - a.date.time);
  },
});
