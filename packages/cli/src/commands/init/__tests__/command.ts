import fixtures from "fixturez";
import fs from "fs-extra";
import path from "path";
import { defaultWrittenConfig } from "@changesets/config";
import { temporarilySilenceLogs } from "@changesets/test-utils";

import initializeCommand from "..";

const f = fixtures(__dirname);

const getPaths = (cwd: string) => ({
  readmePath: path.join(cwd, ".changeset/README.md"),
  configPath: path.join(cwd, ".changeset/config.json")
});

describe("init", () => {
  temporarilySilenceLogs();
  it("should initialize in a project without a .changeset folder", async () => {
    const cwd = await f.copy("without-existing-changeset");
    const { readmePath, configPath } = getPaths(cwd);

    expect(fs.pathExistsSync(readmePath)).toBe(false);
    expect(fs.pathExistsSync(configPath)).toBe(false);
    await initializeCommand(cwd);
    expect(fs.pathExistsSync(readmePath)).toBe(true);
    expect(fs.pathExistsSync(configPath)).toBe(true);
  });
  it("should write the default config if it doesn't exist", async () => {
    const cwd = await f.copy("simple-project");
    await fs.remove(path.join(cwd, ".changeset/config.json"));

    expect(fs.pathExistsSync(path.join(cwd, ".changeset/README.md"))).toBe(
      true
    );
    await initializeCommand(cwd);
    expect(await fs.readJson(path.join(cwd, ".changeset/config.json"))).toEqual(
      defaultWrittenConfig
    );
  });
  it("shouldn't overwrite a config if it does exist", async () => {
    const cwd = await f.copy("simple-project");
    await fs.writeJson(path.join(cwd, ".changeset/config.json"), {
      changelog: false
    });

    expect(fs.pathExistsSync(path.join(cwd, ".changeset/README.md"))).toBe(
      true
    );
    await initializeCommand(cwd);
    expect(await fs.readJson(path.join(cwd, ".changeset/config.json"))).toEqual(
      {
        changelog: false
      }
    );
  });
});
