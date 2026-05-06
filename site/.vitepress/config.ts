import { defineConfig } from "vitepress";
import packageJson from "../../packages/cli/package.json" with { type: "json" };

const changesetsVersion = packageJson.version;

export default defineConfig({
  title: "Changesets",
  head: [["link", { rel: "icon", href: "logo.svg" }]],

  lastUpdated: true,
  cleanUrls: true,

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
        link: "/guide/intro/what-are-changesets",
      },
      {
        text: "Lib",
        link: "/lib/apply-release-plan",
      },
      {
        text: "FAQ",
        link: "/faq/publishing-in-monorepos",
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
      "/guide": {
        base: "guide",
        items: [
          {
            text: "Intro",
            base: "/guide/intro/",
            items: [
              { text: "What are Changesets", link: "what-are-changesets" },
              { text: "Concepts", link: "concepts" },
              { text: "Dictionary", link: "dictionary" },
              { text: "Getting Stared", link: "getting-started" },
            ],
          },
          {
            text: "Basic",
            base: "/guide/basic/",
            items: [
              { text: "Adding a Changeset", link: "adding-a-changeset" },
              {
                text: "Automating Changesets",
                link: "automating-changesets",
              },
              {
                text: "Checking for Changesets",
                link: "checking-for-changesets",
              },
              { text: "Configuration", link: "configuration" },
            ],
          },
          {
            text: "Advance",
            base: "/guide/advance/",
            items: [
              { text: "Fixed Packages", link: "fixed-packages" },
              { text: "Linked Packages", link: "linked-packages" },
              {
                text: "Modifying Changelog Format",
                link: "modifying-changelog-format",
              },
              { text: "Pre Releases", link: "pre-releases" },
              { text: "Snapshot Releases", link: "snapshot-releases" },
              { text: "Versioning Apps", link: "versioning-apps" },
            ],
          },
          {
            text: "Api Reference",
            base: "/guide/api/",
            items: [{ text: "CLI", link: "cli" }],
          },
        ],
      },
      "/faq": {
        base: "faq",
        items: [
          {
            base: "/faq/",
            items: [
              {
                text: "Pushing in Monorepos?",
                link: "publishing-in-monorepos",
              },
            ],
          },
        ],
      },
      "/lib": {
        base: "lib",
        items: [
          {
            base: "/lib/",
            items: [
              { text: "apply-release-plan", link: "apply-release-plan" },
              {
                text: "assemble-release-plan",
                link: "assemble-release-plan",
              },
              { text: "changelog-git", link: "changelog-git" },
              { text: "changelog-github", link: "changelog-github" },
              { text: "cli", link: "cli" },
              { text: "git", link: "git" },
              { text: "pre", link: "pre" },
              { text: "release-utils", link: "release-utils" },
              { text: "get-release-plan", link: "get-release-plan" },
              { text: "get-github-info", link: "get-github-info" },
              {
                text: "get-version-range-type",
                link: "get-version-range-type",
              },
              {
                text: "get-dependents-graph",
                link: "get-dependents-graph",
              },
              { text: "logger", link: "logger" },
              { text: "parse", link: "parse" },
              { text: "should-skip-package", link: "should-skip-package" },
              { text: "types", link: "types" },
              { text: "config", link: "config" },
              { text: "errors", link: "errors" },
              { text: "read", link: "read" },
              { text: "write", link: "write" },
            ],
          },
        ],
      },
    },
  },
});
