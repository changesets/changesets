import { DefaultTheme, defineConfig } from "vitepress";

export default defineConfig({
  base: "/changesets/",
  title: "Changesets",
  head: [["link", { rel: "icon", href: "logo.svg" }]],

  lastUpdated: true,
  cleanUrls: true,
  metaChunk: true,

  srcDir: "src",

  themeConfig: {
    logo: "/logo.svg",
    editLink: {
      pattern:
        "https://github.com/changesets/changesets/edit/main/site/src/:path",
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/changesets/changesets" },
    ],

    search: {
      provider: "local",
      options: {
        miniSearch: {
          /**
           * @type {Pick<import('minisearch').Options, 'extractField' | 'tokenize' | 'processTerm'>}
           */
          options: {
            _render(src, env, md) {
              const html = md.render(src, env);
              if (env.frontmatter?.title)
                return md.render(`# ${env.frontmatter.title}`) + html;
              return html;
            },
          },
          /**
           * @type {import('minisearch').SearchOptions}
           * @default
           * { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 } }
           */
          searchOptions: {
            /* ... */
          },
        },
      },
    },
  } as DefaultTheme.Config,
});
