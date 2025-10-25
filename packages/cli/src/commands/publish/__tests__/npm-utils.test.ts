import type { PackageJSON } from "@changesets/types";
import npmFetch from "npm-registry-fetch";
import { getPackageInfo } from "../npm-utils";

jest.mock("npm-registry-fetch", () => {
  const json = jest.fn();
  return {
    __esModule: true,
    default: { json },
    json,
  };
});

const mockedJson = (npmFetch as unknown as { json: jest.Mock }).json;

describe("getPackageInfo", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns the packument when the registry resolves successfully", async () => {
    const packument = { versions: ["1.0.0-alpha.0", "1.0.0"] };
    mockedJson.mockResolvedValueOnce(packument);

    const result = await getPackageInfo({
      name: "@scope/test-package",
    } as unknown as PackageJSON);

    expect(result).toBe(packument);
    expect(mockedJson).toHaveBeenCalledWith(
      "@scope/test-package",
      expect.objectContaining({
        registry: expect.any(String),
        fullMetadata: true,
        preferOnline: true,
      })
    );
  });

  it("maps 404 errors to the expected error shape", async () => {
    const error = Object.assign(new Error("not found"), { code: "E404" });
    mockedJson.mockRejectedValueOnce(error);

    const result = await getPackageInfo({
      name: "missing-package",
    } as unknown as PackageJSON);

    expect(result).toEqual({
      error: {
        code: "E404",
        summary: undefined,
        detail: undefined,
      },
    });
  });
});
