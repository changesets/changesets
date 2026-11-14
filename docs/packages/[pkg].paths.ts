import fs from "node:fs/promises";
import path from "node:path";
import { defineRoutes, type SiteConfig } from "vitepress";

const config: SiteConfig = (globalThis as any).VITEPRESS_CONFIG;

export default defineRoutes({
  watch: ["../../packages/*/README.md", "../../packages/*/package.json"],

  async paths() {
    // Get packages to generate based on configured sidebar packages items
    const sidebarItems = config.site.themeConfig.sidebar["/packages/"].items;
    const packages: string[] = sidebarItems
      .find((item: any) => item.base === "/packages/")!
      .items.map((item: any) => item.link);

    return await Promise.all(
      packages.map(async (pkg) => {
        const pkgDir = path.join(import.meta.dirname, `../../packages/${pkg}`);
        const readmePath = path.join(pkgDir, "README.md");
        const pkgJsonPath = path.join(pkgDir, "package.json");

        const readmeContent = await fs.readFile(readmePath, "utf-8");
        const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));

        const content = updateMarkdown(readmeContent, pkgJson, readmePath);

        return { params: { pkg }, content };
      }),
    );
  },
});

function updateMarkdown(
  content: string,
  pkgJson: Record<string, any>,
  contentPath: string,
): string {
  // Remove badges
  const badgeRegex = /\[!\[.*?\]\(.*?\)\]\(.*?\)/g;
  content = content.replace(badgeRegex, "");

  // Relative links to our docs
  const docsRegex = /https:\/\/changesets\.dev\//g;
  content = content.replace(docsRegex, "/");

  // Add our own badges
  const h1Regex = /^# (.+)$/m;
  if (!h1Regex.test(content)) {
    throw new Error(
      `The h1 title is missing in ${contentPath} which is required for docs`,
    );
  }
  content = content.replace(
    h1Regex,
    `\
# $1

<a :class="$style.badge" href="https://npmx.dev/package/${pkgJson.name}" target="_blank">
  <Badge type="warning" text="v${pkgJson.version}" />
</a>
<a :class="$style.badge" href="${getRepoLink(pkgJson)}" target="_blank">
  <Badge type="tip" text="Repository" />
</a>
<a :class="$style.badge" href="${getRepoLink(pkgJson)}/CHANGELOG.md" target="_blank">
  <Badge type="tip" text="Changelog" />
</a>

<style module>
.badge {
  display: inline-block;
  margin-top: 0.7rem;
  margin-right: 0.3rem;
}
</style>`,
  );

  // Add "Installation" section before "Usage" section
  const usageRegex = /^## Usage$/m;
  if (!usageRegex.test(content)) {
    throw new Error(
      `The "Usage" section is missing in ${contentPath} which is required for docs`,
    );
  }
  content = content.replace(
    usageRegex,
    `\
## Installation

::: code-group

\`\`\`bash [pnpm]
$ pnpm add -D ${pkgJson.name}
\`\`\`

\`\`\`bash [npm]
$ npm install -D ${pkgJson.name}
\`\`\`

\`\`\`bash [yarn]
$ yarn add -D ${pkgJson.name}
\`\`\`

:::

## Usage`,
  );

  return content;
}

function getRepoLink(pkgJson: Record<string, any>): string {
  const repoUrl = pkgJson.repository?.url ?? "";
  const repoBase = repoUrl.replace(/^git\+/, "").replace(/\.git$/, "");
  const repoPath = pkgJson.repository?.directory ?? "";
  return `${repoBase}/tree/main/${repoPath}`;
}
