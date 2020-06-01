import fixtures from "fixturez";
import { error } from "@changesets/logger";

import { run } from "./run";

const f = fixtures(__dirname);
jest.mock("@changesets/logger");
jest.mock("./commands/version");

describe("cli", () => {
  describe("version", () => {
    let cwd: string;
    beforeEach(async () => {
      cwd = await f.copy("simple-project");
    });

    it("should validate package name passed in from --ignore flag", async () => {
      try {
        await run(["version"], { ignore: "pkg-c" }, cwd);
      } catch (e) {
        // ignore errors. We just want to validate the error message
      }

      const loggerErrorCalls = (error as any).mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toEqual(
        `The package "pkg-c" is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`
      );
    });

    it("should throw if dependents of ignored packages are not explicitly listed in the ignore array", async () => {
      try {
        await run(["version"], { ignore: ["pkg-b"] }, cwd);
      } catch (e) {
        // ignore the error. We just want to validate the error message
      }

      const loggerErrorCalls = (error as any).mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toEqual(
        `The package "pkg-a" depends on the ignored package "pkg-b", but "pkg-a" is not being ignored. Please pass "pkg-a" to the \`--ignore\` flag.`
      );
    });

    it("should throw if `--ignore` flag is used while ignore array is also defined in the config file ", async () => {
      cwd = await f.copy("simple-project-with-ignore-config");
      try {
        await run(["version"], { ignore: "pkg-b" }, cwd);
      } catch (e) {
        // ignore errors. We just want to validate the error message
      }

      const loggerErrorCalls = (error as any).mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toEqual(
        `It looks like you are trying to use the \`--ignore\` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.`
      );
    });
  });
});
