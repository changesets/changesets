import fixtures from "fixturez";

import publishPackages from "../publishPackages";
import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import { temporarilySilenceLogs } from "@changesets/test-utils";
import runRelease from "..";

jest.mock("../../../utils/cli-utilities");
jest.mock("@changesets/git");
jest.mock("../publishPackages");

const f = fixtures(__dirname);

// @ts-ignore
git.tag.mockImplementation(() => Promise.resolve(true));
// we want to keep other bolt commands still running so our tests are more e2e
// NOTE: This is pretty terrible. Quite obviously bolt is not going to return these results
// each time, but there is only one test that uses the output of this function ('should add git tags')
// and we know this will be heavily refactored once its moved into the bolt org anyway. So we are happy
// to keep this debt in for now. LB takes full responsibility for this if it becomes flakey.

// @ts-ignore
publishPackages.mockImplementation(() =>
  Promise.resolve([
    { name: "pkg-a", newVersion: "1.1.0", published: true },
    { name: "pkg-b", newVersion: "1.0.1", published: true }
  ])
);

describe("running release", () => {
  temporarilySilenceLogs();
  let cwd: string;

  beforeEach(async () => {
    cwd = await f.copy("simple-project");
  });

  describe("When there is no changeset commits", () => {
    // we make sure we still do this so that a later build can clean up after a previously
    // failed one (where the change was pushed back but not released and the next build has no
    // changeset commits)
    it("should still run publishPackages", async () => {
      await runRelease(cwd, {}, defaultConfig);

      expect(publishPackages).toHaveBeenCalled();
    });
  });
});
