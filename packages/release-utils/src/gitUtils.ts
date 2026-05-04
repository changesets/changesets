import { exec } from "tinyexec";

export const getCurrentBranch = async (cwd: string) => {
  const { stdout } = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    nodeOptions: { cwd },
  });
  return stdout.trim();
};

export const pullBranch = async (branch: string, cwd: string) => {
  await exec("git", ["pull", "origin", branch], { nodeOptions: { cwd } });
};

export const push = async (
  branch: string,
  {
    force,
    includeTags,
    cwd,
  }: { force?: boolean; includeTags?: boolean; cwd: string },
) => {
  await exec(
    "git",
    [
      "push",
      "origin",
      `HEAD:${branch}`,
      includeTags && "--tags",
      force && "--force",
    ].filter((x): x is string => !!x),
    { nodeOptions: { cwd } },
  );
};

export const switchToMaybeExistingBranch = async (
  branch: string,
  cwd: string,
) => {
  let { stderr } = await exec("git", ["checkout", branch], {
    nodeOptions: { cwd },
    throwOnError: false,
  });
  let isCreatingBranch = !stderr
    .toString()
    .includes(`Switched to a new branch '${branch}'`);
  if (isCreatingBranch) {
    await exec("git", ["checkout", "-b", branch], { nodeOptions: { cwd } });
  }
};

export const reset = async (
  pathSpec: string,
  mode: "hard" | "soft" | "mixed" = "hard",
  cwd: string,
) => {
  await exec("git", ["reset", `--${mode}`, pathSpec], { nodeOptions: { cwd } });
};

export const commitAll = async (message: string, cwd: string) => {
  await exec("git", ["add", "."], { nodeOptions: { cwd } });
  await exec("git", ["commit", "-m", message], { nodeOptions: { cwd } });
};

export const checkIfClean = async (cwd: string): Promise<boolean> => {
  const { stdout } = await exec("git", ["status", "--porcelain"], {
    nodeOptions: { cwd },
  });
  return !stdout.length;
};
