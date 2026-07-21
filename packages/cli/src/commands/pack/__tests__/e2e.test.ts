import fs from "node:fs/promises";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { gitdir } from "@changesets/test-utils";
import { describe, expect, it } from "vitest";
import {
  AbortableAsyncDisposableStack,
  createPkgAFixture,
  getPmBinPath,
  pmCases,
  runCliCommand,
  setTestGitdir,
} from "../../__tests__/e2e-utils.ts";

setTestGitdir(gitdir);

function sanitizePackLog(message: unknown) {
  return (
    stripVTControlCharacters(String(message))
      // Normalize CRLF line endings from Windows PTY output.
      .replaceAll("\r\n", "\n")
      // Normalize standalone carriage returns used for terminal progress redraws.
      .replaceAll("\r", "\n")
      .replace(/changeset v\S+/g, "changeset v[version]")
      .replace(/(➤ YN0000: Done in )\d+s \d+ms/g, "$1[duration]")
      .replace(
        /^[A-Za-z]:\\(?:[^\\\r\n]+\\)*cmd\.exe \/d \/s \/c /gim,
        "sh -c ",
      )
      .replace(
        /logs can be found here: .*?\.log/g,
        "logs can be found here: [yarn-prepack-log]",
      )
  );
}

// to avoid depending on pnpr here we only test the pack command with precomputed publish plans
describe("Pack command e2e", { tags: ["slow"] }, () => {
  describe.each(pmCases)("$name", (pm) => {
    it("packs from a publish plan", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const cwd = await pm.gitdir(
        {
          pmBinPath,
        },
        {
          ...createPkgAFixture(),
          "publish-plan.json": JSON.stringify({
            version: 1,
            plan: [
              [
                {
                  kind: "publish",
                  name: "pkg-a",
                  version: "1.0.0",
                  access: "public",
                  tag: "latest",
                },
              ],
            ],
          }),
        },
      );

      const result = await runCliCommand({
        command: "pack",
        args: [
          "--from-publish-plan",
          "publish-plan.json",
          "--out-dir",
          ".packed",
        ],
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect.soft(result.stderr).toBe("");
      expect.soft(sanitizePackLog(result.stdout)).toMatchSnapshot();
      const tarball = await fs.stat(
        path.join(cwd, ".packed/packages/pkg-a-1.0.0.tgz"),
      );
      expect.soft(tarball.size).toBeGreaterThan(0);

      const packedPlan = JSON.parse(
        await fs.readFile(path.join(cwd, ".packed/publish-plan.json"), "utf8"),
      );
      expect.soft(packedPlan).toMatchObject({
        plan: [
          [
            {
              kind: "publish",
              name: "pkg-a",
              tarball: {
                integrity: expect.stringMatching(/^sha256-/),
                path: "packages/pkg-a-1.0.0.tgz",
              },
              version: "1.0.0",
            },
          ],
        ],
        version: 1,
      });
    });

    it("handles lifecycle stdout while packing", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const cwd = await pm.gitdir(
        {
          pmBinPath,
        },
        {
          ...createPkgAFixture(),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            description: "",
            files: ["index.js"],
            license: "MIT",
            scripts: {
              prepack:
                "node -e \"console.log(JSON.stringify({ lifecycle: 'output' }))\"",
            },
            type: "module",
          }),
          "publish-plan.json": JSON.stringify({
            version: 1,
            plan: [
              [
                {
                  kind: "publish",
                  name: "pkg-a",
                  version: "1.0.0",
                  access: "public",
                  tag: "latest",
                },
              ],
            ],
          }),
        },
      );

      const result = await runCliCommand({
        command: "pack",
        args: [
          "--from-publish-plan",
          "publish-plan.json",
          "--out-dir",
          ".packed",
        ],
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect.soft(result.stderr).toBe("");
      expect.soft(sanitizePackLog(result.stdout)).toMatchSnapshot();
      const tarball = await fs.stat(
        path.join(cwd, ".packed/packages/pkg-a-1.0.0.tgz"),
      );
      expect.soft(tarball.size).toBeGreaterThan(0);
    });

    it("surfaces pack errors", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const cwd = await pm.gitdir(
        {
          pmBinPath,
        },
        {
          ...createPkgAFixture(),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            description: "",
            files: ["index.js"],
            license: "MIT",
            scripts: {
              prepack:
                "node -e \"console.log(JSON.stringify({ lifecycle: 'output' })); console.error('prepack failed'); process.exit(1)\"",
            },
            type: "module",
          }),
          "publish-plan.json": JSON.stringify({
            version: 1,
            plan: [
              [
                {
                  kind: "publish",
                  name: "pkg-a",
                  version: "1.0.0",
                  access: "public",
                  tag: "latest",
                },
              ],
            ],
          }),
        },
      );

      const result = await runCliCommand({
        command: "pack",
        args: [
          "--from-publish-plan",
          "publish-plan.json",
          "--out-dir",
          ".packed",
        ],
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect.soft(sanitizePackLog(result.stdout)).toMatchSnapshot();
      await expect
        .soft(fs.access(path.join(cwd, ".packed/publish-plan.json")))
        .rejects.toThrow();
    });
  });
});
