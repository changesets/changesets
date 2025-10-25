import type { PackageJSON } from "@changesets/types";
import { packument } from "pacote";
import { getPackageInfo } from "../npm-utils";

jest.mock("pacote", () => ({
  packument: jest.fn(),
}));

const mockedPackument = packument as jest.MockedFunction<typeof packument>;

describe("getPackageInfo", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns the packument when the registry resolves successfully", async () => {
    // pacote returns versions as an object with version strings as keys
    const packumentData = {
      versions: {
        "1.0.0-alpha.0": {},
        "1.0.0": {},
      },
    };
    mockedPackument.mockResolvedValueOnce(packumentData as any);

    const result = await getPackageInfo({
      name: "@scope/test-package",
    } as unknown as PackageJSON);

    // getPackageInfo converts versions object to an array
    expect(result).toEqual({
      versions: ["1.0.0-alpha.0", "1.0.0"],
    });
    expect(mockedPackument).toHaveBeenCalledWith(
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
    mockedPackument.mockRejectedValueOnce(error);

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
