import { getPackages, type Package } from "@manypkg/get-packages";
import cp, { type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { SIGTERM } from "node:constants";
import { toString as mdastNodeToString } from "mdast-util-to-string";
import os from "os";
import { fromMarkdown as stringToMdast } from "mdast-util-from-markdown";
import { toMarkdown as mdastToString } from "mdast-util-to-markdown";
import spawn from "spawndamnit";
import { onExit } from "signal-exit";

const exec = promisify(cp.exec);

export const BumpLevels = {
  dep: 0,
  patch: 1,
  minor: 2,
  major: 3,
} as const;

export async function getVersionsByDirectory(cwd: string) {
  let { packages } = await getPackages(cwd);
  return new Map(packages.map((x) => [x.dir, x.packageJson.version]));
}

export async function getChangedPackages(
  cwd: string,
  previousVersions: Map<string, string>,
) {
  let { packages } = await getPackages(cwd);
  let changedPackages = new Set<Package>();

  for (let pkg of packages) {
    const previousVersion = previousVersions.get(pkg.dir);
    if (previousVersion !== pkg.packageJson.version) {
      changedPackages.add(pkg);
    }
  }

  return [...changedPackages];
}

export function getChangelogEntry(changelog: string, version: string) {
  let ast = stringToMdast(changelog);

  let highestLevel: number = BumpLevels.dep;

  let nodes = ast.children;
  let headingStartInfo:
    | {
        index: number;
        depth: number;
      }
    | undefined;
  let endIndex: number | undefined;

  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (node.type === "heading") {
      let stringified: string = mdastNodeToString(node);
      let match = stringified.toLowerCase().match(/(major|minor|patch)/);
      if (match !== null) {
        let level = BumpLevels[match[0] as "major" | "minor" | "patch"];
        highestLevel = Math.max(level, highestLevel);
      }
      if (headingStartInfo === undefined && stringified === version) {
        headingStartInfo = {
          index: i,
          depth: node.depth,
        };
        continue;
      }
      if (
        endIndex === undefined &&
        headingStartInfo !== undefined &&
        headingStartInfo.depth === node.depth
      ) {
        endIndex = i;
        break;
      }
    }
  }
  if (headingStartInfo) {
    ast.children = (ast.children as any).slice(
      headingStartInfo.index + 1,
      endIndex,
    );
  }
  return {
    content: mdastToString(ast),
    highestLevel,
  };
}

const activeProcesses = new Set<ChildProcess>();

onExit(() => {
  for (let child of activeProcesses) {
    child.kill(SIGTERM);
  }
});

export async function execWithOutput(
  command: string,
  options: { ignoreReturnCode?: boolean; cwd: string },
) {
  process.stdout.write(`Running: ${command}` + os.EOL);

  let childProcess = exec(command, {
    cwd: options.cwd,
  });

  activeProcesses.add(childProcess.child);

  childProcess.child.on("stdout", (data) => process.stdout.write(data));
  childProcess.child.on("stderr", (data) => process.stderr.write(data));

  childProcess.child.on("error", () =>
    activeProcesses.delete(childProcess.child),
  );
  childProcess.child.on("close", () =>
    activeProcesses.delete(childProcess.child),
  );

  let result = await childProcess;

  if (!options?.ignoreReturnCode && childProcess.child.exitCode !== 0) {
    throw new Error(
      `The command ${JSON.stringify(command)} failed with code ${
        childProcess.child.exitCode
      }\n${result.stdout}\n${result.stderr}`,
    );
  }
  return {
    code: childProcess.child.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export async function spawnWithOutput(
  command: string,
  args: string[],
  options: { ignoreReturnCode?: boolean; cwd: string },
) {
  process.stdout.write(`Running: ${command} ${args.join(" ")}` + os.EOL);
  let childProcess = spawn(command, args, {
    cwd: options.cwd,
  });
  childProcess.on("stdout", (data) => process.stdout.write(data));
  childProcess.on("stderr", (data) => process.stderr.write(data));
  let result = await childProcess;
  if (!options?.ignoreReturnCode && result.code !== 0) {
    throw new Error(
      `The command "${command} ${args.join(" ")}" failed with code ${
        result.code
      }\n${result.stdout.toString("utf8")}\n${result.stderr.toString("utf8")}`,
    );
  }
  return {
    code: result.code,
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8"),
  };
}

export function sortChangelogEntries(
  a: { private: boolean; highestLevel: number },
  b: { private: boolean; highestLevel: number },
) {
  if (a.private === b.private) {
    return b.highestLevel - a.highestLevel;
  }
  if (a.private) {
    return 1;
  }
  return -1;
}
