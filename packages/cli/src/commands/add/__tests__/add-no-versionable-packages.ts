import { defaultConfig } from "@changesets/config";
import * as logger from "@changesets/logger";
import { testdir } from "@changesets/test-utils";

import addChangeset from "..";

describe("Add command - no versionable packages", () => {
  const loggerErrorSpy = jest
    .spyOn(logger, "error")
    .mockImplementation(jest.fn(() => {}));

  it("should print an informative message when in a polyrepo", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "test-missing-version",
      }),
    });

    await expect(() =>
      addChangeset(cwd, { empty: false }, defaultConfig)
    ).rejects.toThrow("The process exited with code: 1");

    expect(loggerErrorSpy).toHaveBeenCalledTimes(3);
    expect(loggerErrorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "No versionable packages found",
        ],
        [
          "- Ensure the packages to version are not in the "ignore" config",
        ],
        [
          "- Ensure that relevant package.json files have the "version" field",
        ],
      ]
    `);
  });

  it("should print an informative message when in a monorepo", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
      }),
    });

    await expect(() =>
      addChangeset(cwd, { empty: false }, defaultConfig)
    ).rejects.toThrow("The process exited with code: 1");

    expect(loggerErrorSpy).toHaveBeenCalledTimes(3);
    expect(loggerErrorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "No versionable packages found",
        ],
        [
          "- Ensure the packages to version are not in the "ignore" config",
        ],
        [
          "- Ensure that relevant package.json files have the "version" field",
        ],
      ]
    `);
  });
});
