import fixtures from "fixturez";
import { temporarilySilenceLogs } from "../../../../../test-utils/src";
import * as git from "@changesets/git";
import tag from "../index";

const f = fixtures(__dirname);

jest.mock("@changesets/git");

describe("Tag command", () => {
  temporarilySilenceLogs();
  let cwd: string;

  describe("workspace project", () => {
    beforeEach(async () => {
      cwd = await f.copy("simple-project");
    });

    it("Tags all packages", async () => {
      (git.getAllTags as jest.Mock).mockReturnValue([]);

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(2);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-a@1.0.0");
      expect((git.tag as jest.Mock).mock.calls[1][0]).toEqual("pkg-b@1.0.0");
    });

    it("Skips tags that already exist", async () => {
      (git.getAllTags as jest.Mock).mockReturnValue([
        // pkg-a should not be re-tagged
        "pkg-a@1.0.0"
      ]);

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-b@1.0.0");
    });
  });

  describe("single package repo", () => {
    beforeEach(async () => {
      cwd = await f.copy("root-only");
    });

    it("Tags all packages", async () => {
      (git.getAllTags as jest.Mock).mockReturnValue([]);

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual(
        "root-only@v1.0.0"
      );
    });
  });
});
