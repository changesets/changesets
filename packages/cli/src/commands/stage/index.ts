import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { exec } from "tinyexec";
import { getPublishTool } from "../publish/getPublishTool.ts";

const STAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StageOptions {
  cwd?: string;
  operation: string;
  ids: string[];
  otp?: string;
  registry?: string;
}

export async function stage(options: StageOptions) {
  if (options.operation !== "approve" && options.operation !== "reject") {
    log.error("Stage operation must be either approve or reject.");
    throw new ExitError(1);
  }
  if (options.ids.length === 0) {
    log.error(`At least one stage ID is required for ${options.operation}.`);
    throw new ExitError(1);
  }
  if (
    options.ids.some((id) => !STAGE_ID_PATTERN.test(id)) ||
    new Set(options.ids).size !== options.ids.length
  ) {
    log.error("Stage IDs must be unique UUIDs.");
    throw new ExitError(1);
  }

  const cwd = options.cwd ?? process.cwd();
  const packages = await getPackages(cwd);
  const publishTool = await getPublishTool(packages);

  for (const id of options.ids) {
    const args =
      publishTool.name === "yarn"
        ? ["npm", "stage", options.operation, id]
        : ["stage", options.operation, id];
    if (options.otp) args.push("--otp", options.otp);
    if (options.registry && publishTool.name !== "yarn") {
      args.push("--registry", options.registry);
    }

    const env =
      options.registry && publishTool.name === "yarn"
        ? {
            ...process.env,
            YARN_NPM_PUBLISH_REGISTRY: options.registry,
          }
        : process.env;
    const { exitCode } = await exec(publishTool.name, args, {
      nodePath: false,
      nodeOptions: {
        cwd: packages.rootDir,
        env,
        stdio: "inherit",
      },
    });
    if (exitCode !== 0) {
      throw new ExitError(exitCode ?? 1);
    }
  }
}
