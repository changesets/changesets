import fs from "node:fs/promises";
import path from "node:path";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { ensureChangesetFolder } from "../shared.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getPublishPlan, type PublishPlan } from "./getPublishPlan.ts";

export interface PublishPlanOptions {
  cwd?: string;
  output?: string;
}

export async function publishPlan(
  options?: PublishPlanOptions,
): Promise<PublishPlan> {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);
  const plan = await getPublishPlan(packages.rootDir, config);
  const entries = plan.flat();
  const releases = entries.filter((release) => release.kind === "publish");
  const tagReleases = entries.filter((release) => release.kind === "tag-only");

  if (options?.output) {
    await fs.writeFile(
      path.resolve(cwd, options.output),
      JSON.stringify(plan, undefined, 2),
    );
    return plan;
  }

  if (releases.length === 0 && tagReleases.length === 0) {
    log.info("No projects to publish or tag.");
    return [];
  }

  if (releases.length > 0) {
    log.info(
      `
Packages to publish:
${releases.map((release) => `- ${release.name}@${release.version} (${release.tag})`).join("\n")}
      `.trim(),
    );
  }

  if (tagReleases.length > 0) {
    log.info(
      `
Packages to tag:
${tagReleases.map((release) => `- ${release.name}@${release.version}`).join("\n")}
      `.trim(),
    );
  }

  return plan;
}
