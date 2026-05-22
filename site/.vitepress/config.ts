import { defineConfig } from "vitepress";
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

const ogTitle = "Changesets";
const ogDescription =
  "A tool to manage versioning and changelogs with a focus on multi-package repositories";
const ogUrl = "https://changesets.dev";
const ogImage = "https://changesets.dev/og-image.png";

export default defineConfig({
  title: ogTitle,
  description: ogDescription,
  head: [
    ["link", { rel: "icon", href: "logo-light.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: ogTitle }],
    ["meta", { property: "og:image", content: ogImage }],
    ["meta", { property: "og:url", content: ogUrl }],
    ["meta", { property: "og:description", content: ogDescription }],
    ["meta", { property: "og:site_name", content: ogTitle }],
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
      "/guide/": {
        base: "/guide/",
        items: [
          {
            text: "Introduction",
            items: [
              { text: "Getting Started", link: "getting-started" },
              { text: "Why Changesets", link: "why" },
              { text: "Technical Decisions", link: "technical-decisions" },
            ],
          },
          {
            text: "API Reference",
            items: [
              { text: "Configuration File", link: "config" },
              { text: "Command Line Interface", link: "cli" },
            ],
          },
          {
            text: "Guides",
            items: [
              { text: "Automating Changesets", link: "automating-changesets" },
              { text: "Fixed Packages", link: "fixed-packages" },
              { text: "Linked Packages", link: "linked-packages" },
              {
                text: "Modifying Changelog Format",
                link: "modifying-changelog-format",
              },
              { text: "Prereleases", link: "prereleases" },
              { text: "Snapshot Releases", link: "snapshot-releases" },
              { text: "Versioning apps", link: "versioning-apps" },
            ],
          },
        ],
      },
    },
  },
});
