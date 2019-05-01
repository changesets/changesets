import { copyFixtureIntoTempDir } from "jest-fixtures";

import * as bolt from "bolt";
import * as git from "../../../utils/git";
import runRelease from "..";

jest.mock("../../../utils/cli");
jest.mock("../../../utils/git");
jest.mock("../../../utils/logger");
jest.mock("../../add/parseChangesetCommit");

git.tag.mockImplementation(() => Promise.resolve(true));
// we want to keep other bolt commands still running so our tests are more e2e
// NOTE: This is pretty terrible. Quite obviously bolt is not going to return these results
// each time, but there is only one test that uses the output of this function ('should add git tags')
// and we know this will be heavily refactored once its moved into the bolt org anyway. So we are happy
// to keep this debt in for now. LB takes full responsibility for this if it becomes flakey.
bolt.publishPackages = jest.fn(() =>
  Promise.resolve([
    { name: "pkg-a", newVersion: "1.1.0", published: true },
    { name: "pkg-b", newVersion: "1.0.1", published: true }
  ])
);

describe("running release", () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("When there is no changeset commits", () => {
    // we make sure we still do this so that a later build can clean up after a previously
    // failed one (where the change was pushed back but not released and the next build has no
    // changeset commits)
    it("should still run bolt.publishPackages", async () => {
      await runRelease({ cwd });

      expect(bolt.publishPackages).toHaveBeenCalled();
    });
  });
});
