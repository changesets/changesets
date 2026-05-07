import { defineConfig } from "vitepress";
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
} from "vitepress-plugin-group-icons";
import packageJson from "../../packages/cli/package.json" with { type: "json" };

const changesetsVersion = packageJson.version;
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
    plugins: [groupIconVitePlugin()],
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

    nav: [
      {
        text: "Guide",
        link: "/guide/introduction/getting-started",
      },
      {
        text: "Resources",
        items: [
          {
            text: "Acknowledgements",
            link: "/acknowledgements",
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
        items: [
          {
            text: "Introduction",
            base: "/guide/introduction/",
            items: [
              { text: "What are Changesets?", link: "what-are-changesets" },
              { text: "Getting Started", link: "getting-started" },
              { text: "Common Questions", link: "common-questions" },
              { text: "Concepts", link: "concepts" },
              { text: "Dictionary", link: "dictionary" },
            ],
          },
          {
            text: "Basic",
            base: "/guide/basic/",
            items: [
              { text: "Adding a Changeset", link: "adding-a-changeset" },
              {
                text: "Checking for Changesets",
                link: "checking-for-changesets",
              },
              { text: "Automating Changesets", link: "automating-changesets" },
              { text: "Configuration", link: "configuration" },
              { text: "CLI Reference", link: "cli" },
            ],
          },
          {
            text: "Advanced",
            base: "/guide/advanced/",
            items: [
              { text: "Decisions", link: "decisions" },
              { text: "Experimental Options", link: "experimental-options" },
              { text: "Fixed Packages", link: "fixed-packages" },
              { text: "Linked Packages", link: "linked-packages" },
              {
                text: "Modifying Changelog Formats",
                link: "modifying-changelog-formats",
              },
              { text: "Prereleases", link: "prereleases" },
              {
                text: "Publishing in Monorepos",
                link: "publishing-in-monorepos",
              },
              { text: "Snapshot Releases", link: "snapshot-releases" },
              { text: "Versioning apps", link: "versioning-apps" },
            ],
          },
        ],
      },
    },
  },
});
