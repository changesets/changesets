import fixtures from "fixturez";
import { silenceLogsInBlock } from "../../../../../test-utils/src";
import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import tag from "../index";

const f = fixtures(__dirname);

jest.mock("@changesets/git");

describe("tag command", () => {
  silenceLogsInBlock();
  let cwd: string;

  describe("workspace project", () => {
    beforeEach(async () => {
      cwd = await f.copy("simple-project");
    });

    it("tags all packages", async () => {
      (git.getAllTags as jest.Mock).mockReturnValue(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd, defaultConfig);
      expect(git.tag).toHaveBeenCalledTimes(2);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-a@1.0.0");
      expect((git.tag as jest.Mock).mock.calls[1][0]).toEqual("pkg-b@1.0.0");
    });

    it("skips tags that already exist", async () => {
      (git.getAllTags as jest.Mock).mockReturnValue(
        new Set([
          // pkg-a should not be re-tagged
          "pkg-a@1.0.0"
        ])
      );

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd, defaultConfig);
      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-b@1.0.0");
    });
  });

  describe("single package repo", () => {
    beforeEach(async () => {
      cwd = await f.copy("root-only");
    });

    it("uses a simplified version-only tag", async () => {
      (git.getAllTags as jest.Mock).mockReturnValue(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd, defaultConfig);
      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("v1.0.0");
    });
  });
});
