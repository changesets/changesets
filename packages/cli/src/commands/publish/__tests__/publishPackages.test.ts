import fixtures from "fixturez";

import publishPackages from "../publishPackages";
import * as npmUtils from "../npm-utils";
import { getPackages } from "@manypkg/get-packages";

jest.mock("../npm-utils");
jest.mock("is-ci", () => true);

const f = fixtures(__dirname);

describe("publishPackages", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await f.copy("simple-project");

    // @ts-ignore
    npmUtils.infoAllow404.mockImplementation(() => ({
      published: false,
      pkgInfo: {
        version: "1.0.0"
      }
    }));

    // @ts-ignore
    npmUtils.publish.mockImplementation(() => ({
      published: true
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when isCI", () => {
    it("does not call out to npm to see if otp is required", async () => {
      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        preState: undefined
      });
      expect(npmUtils.getTokenIsRequired).not.toHaveBeenCalled();
    });
  });
});
