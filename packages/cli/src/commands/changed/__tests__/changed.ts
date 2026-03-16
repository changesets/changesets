import path from "path";
import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import { silenceLogsInBlock, gitdir } from "@changesets/test-utils";
import { log, error as loggerError } from "@changesets/logger";
import fs from "fs-extra";

import changed from "..";

jest.mock("@changesets/logger", () => ({
  ...jest.requireActual("@changesets/logger"),
  log: jest.fn(),
  error: jest.fn(),
}));

describe("Changed command", () => {
  silenceLogsInBlock();

  it("should list changed packages", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    // Create a branch and modify pkg-a
    await fs.outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "a"'
    );
    await git.add(".", cwd);
    await git.commit("update pkg-a", cwd);

    await changed(cwd, { since: "HEAD~1" }, defaultConfig);

    expect(log).toHaveBeenCalledWith("pkg-a");
    expect(log).not.toHaveBeenCalledWith("pkg-b");
  });

  it("should output JSON when --json is passed", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    await fs.outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "a"'
    );
    await git.add(".", cwd);
    await git.commit("update pkg-a", cwd);

    await changed(cwd, { since: "HEAD~1", json: true }, defaultConfig);

    const lastCall = (log as jest.Mock).mock.calls.find((call) => {
      try {
        const parsed = JSON.parse(call[0]);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    });

    expect(lastCall).toBeDefined();
    const output = JSON.parse(lastCall![0]);
    expect(output).toEqual([
      expect.objectContaining({ name: "pkg-a" }),
    ]);
  });

  it("should show error when no changed packages found", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    await changed(cwd, { since: "HEAD" }, defaultConfig);

    expect(loggerError).toHaveBeenCalledWith("No changed packages found");
  });
});
