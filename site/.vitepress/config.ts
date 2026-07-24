import { type DefaultTheme, defineConfig } from "vitepress";
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
  localIconLoader,
} from "vitepress-plugin-group-icons";
import packageJson from "../../packages/cli/package.json" with { type: "json" };

// Netlify envs
const commitRef = process.env.COMMIT_REF;

const changesetsVersion = packageJson.version;
const currentYear = new Date().getFullYear();
const netlifyLink = `<a href="https://www.netlify.com" target="_blank">Netlify</a>`;
const commitLink = commitRef
  ? `<a href="https://github.com/changesets/changesets/commit/${commitRef}" target="_blank">${commitRef.slice(0, 7)}</a>`
  : "dev";

const siteUrl = "https://changesets.dev";
const siteTitle = "Changesets";
const siteDescription =
  "A tool to manage versioning and changelogs with a focus on monorepos";
const defaultOgImage = "https://changesets.dev/og-image.png";

export default defineConfig({
  title: siteTitle,
  description: siteDescription,
  head: [
    ["link", { rel: "icon", href: "logo-light.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: siteTitle }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "theme-color", content: "#006dcc" }],
  ],
  lastUpdated: true,
  cleanUrls: true,
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
    },
  },
  vite: {
    plugins: [
      groupIconVitePlugin({
        customIcon: {
          typescript: "vscode-icons:file-type-typescript-official",
          javascript: "vscode-icons:file-type-js-official",
          ".changeset/config.json": {
            light: localIconLoader(import.meta.url, "../public/logo-light.svg"),
            dark: localIconLoader(import.meta.url, "../public/logo-dark.svg"),
          },
        },
      }),
    ],
  },
  themeConfig: {
    logo: {
      light: "/logo-light.svg",
      dark: "/logo-dark.svg",
      alt: "Changesets logo",
    },
    editLink: {
      pattern: "https://github.com/changesets/changesets/edit/main/site/:path",
    },
    socialLinks: [
      { icon: "discord", link: "https://chat.changesets.dev" },
      { icon: "github", link: "https://github.com/changesets/changesets" },
      { icon: "npm", link: "https://npmx.dev/package/@changesets/cli" },
    ],
    search: {
      provider: "local",
    },
    outline: {
      level: [2, 3],
    },

    footer: {
      message: `This site is powered by ${netlifyLink}`,
      copyright: `© ${currentYear} Changesets (${commitLink})`,
    },

    nav: [
      {
        text: "Guide",
        link: "/guide/getting-started",
        activeMatch: "^/guide/",
      },
      {
        text: "FAQ",
        link: "/faq",
      },
      {
        text: "Resources",
        items: [
          {
            text: "Blog",
            link: "/blog/",
          },
          {
            text: "Acknowledgements",
            link: "/acknowledgements",
          },
          {
            text: "Code of Conduct",
            link: "https://github.com/changesets/.github/blob/main/CODE_OF_CONDUCT.md",
          },
        ],
      },
      {
        text: `v${changesetsVersion}`,
        items: [
          {
            text: `v${changesetsVersion}`,
            link: `https://github.com/changesets/changesets/releases/tag/%40changesets%2Fcli%40${changesetsVersion}`,
          },
          {
            text: "Changelog",
            link: "https://github.com/changesets/changesets/blob/main/packages/cli/CHANGELOG.md",
          },
        ],
      },
    ],

    sidebar: {
      "/guide/": { items: getMainSidebar() },
      "/packages/": { items: getMainSidebar() },
    },
  },
  transformHead(ctx) {
    const pathname =
      "/" + ctx.page.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
    const ogUrl = `${siteUrl}${pathname}`;
    const isBlogPost = pathname.startsWith("/blog/") && pathname !== "/blog/";

    return [
      ["meta", { property: "og:title", content: ctx.title }],
      ["meta", { property: "og:description", content: ctx.description }],
      ["meta", { property: "og:url", content: ogUrl }],
      [
        "meta",
        {
          property: "og:image",
          content: isBlogPost ? `${ogUrl}.png` : defaultOgImage,
        },
      ],
    ];
  },
});

function getMainSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Introduction",
      base: "/guide/",
      items: [
        { text: "Getting Started", link: "getting-started" },
        { text: "Why Changesets", link: "why" },
        { text: "Technical Decisions", link: "technical-decisions" },
        { text: "Migration from v2", link: "migration" },
      ],
    },
    {
      text: "API Reference",
      base: "/guide/",
      items: [
        { text: "Configuration File", link: "config" },
        { text: "Command Line Interface", link: "cli" },
      ],
    },
    {
      text: "Guides",
      base: "/guide/",
      items: [
        {
          text: "Versioning and Publishing",
          link: "versioning-and-publishing",
        },
        { text: "Automating Changesets", link: "automating" },
        { text: "Backporting Changes", link: "backporting-changes" },
        { text: "Fixed Packages", link: "fixed-packages" },
        { text: "Linked Packages", link: "linked-packages" },
        {
          text: "Customize Changelog Format",
          link: "customize-changelog-format",
        },
        {
          text: "Customize Commit Format",
          link: "customize-commit-format",
        },
        { text: "Snapshot Releases", link: "snapshot-releases" },
        { text: "Prereleases", link: "prereleases" },
        { text: "Private Packages", link: "private-packages" },
      ],
    },
    {
      text: "Packages",
      base: "/packages/",
      items: [
        { text: "@changesets/changelog-github", link: "changelog-github" },
        { text: "@changesets/config", link: "config" },
        { text: "@changesets/parse", link: "parse" },
      ],
    },
  ];
}
