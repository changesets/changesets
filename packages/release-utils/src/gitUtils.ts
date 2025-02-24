import { spawnWithOutput } from "./utils.ts";

export const getCurrentBranch = async (cwd: string) => {
  const { stdout } = await spawnWithOutput(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd }
  );
  return stdout.trim();
};

export const pullBranch = async (branch: string, cwd: string) => {
  await spawnWithOutput("git", ["pull", "origin", branch], { cwd });
};

export const push = async (
  branch: string,
  {
    force,
    includeTags,
    cwd,
  }: { force?: boolean; includeTags?: boolean; cwd: string }
) => {
  await spawnWithOutput(
    "git",
    [
      "push",
      "origin",
      `HEAD:${branch}`,
      includeTags && "--tags",
      force && "--force",
    ].filter((x): x is string => !!x),
    { cwd }
  );
};

export const switchToMaybeExistingBranch = async (
  branch: string,
  cwd: string
) => {
  let { stderr } = await spawnWithOutput("git", ["checkout", branch], {
    ignoreReturnCode: true,
    cwd,
  });
  let isCreatingBranch = !stderr
    .toString()
    .includes(`Switched to a new branch '${branch}'`);
  if (isCreatingBranch) {
    await spawnWithOutput("git", ["checkout", "-b", branch], { cwd });
  }
};

export const reset = async (
  pathSpec: string,
  mode: "hard" | "soft" | "mixed" = "hard",
  cwd: string
) => {
  await spawnWithOutput("git", ["reset", `--${mode}`, pathSpec], { cwd });
};

export const commitAll = async (message: string, cwd: string) => {
  await spawnWithOutput("git", ["add", "."], {
    cwd,
  });
  await spawnWithOutput("git", ["commit", "-m", message], { cwd });
};

export const checkIfClean = async (cwd: string): Promise<boolean> => {
  const { stdout } = await spawnWithOutput("git", ["status", "--porcelain"], {
    cwd,
  });
  return !stdout.length;
};
