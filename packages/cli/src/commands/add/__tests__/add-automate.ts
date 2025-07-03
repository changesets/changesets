import { testdir } from "@changesets/test-utils";
import { defaultConfig } from "@changesets/config";
import writeChangeset from "@changesets/write";
import { getVersionableChangedPackages } from "../../../utils/versionablePackages";
import addChangeset from "..";

jest.mock("../../../utils/versionablePackages");

// @ts-ignore
writeChangeset.mockImplementation(() => Promise.resolve("abcdefg"));
// @ts-ignore
getVersionableChangedPackages.mockImplementation(() => {
  return [
    {
      packageJson: { name: "pkg-a" },
      dir: "/pkg-a",
    },
    {
      packageJson: { name: "pkg-b" },
      dir: "/pkg-b",
    },
  ];
});

it("should skip questions when allChanged, minor and summary flags passed in", async () => {
  const cwd = await testdir({
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["packages/*"],
    }),
    "packages/pkg-a/package.json": JSON.stringify({
      name: "pkg-a",
      version: "1.0.0",
      dependencies: {
        "pkg-b": "1.0.0",
      },
    }),
    "packages/pkg-b/package.json": JSON.stringify({
      name: "pkg-b",
      version: "1.0.0",
    }),
  });

  await addChangeset(
    cwd,
    { empty: false, allChanged: true, minor: true, summary: "foo-bar" },
    {
      ...defaultConfig,
    }
  );

  // @ts-ignore
  const call = writeChangeset.mock.calls[0][0];
  expect(call).toEqual(
    expect.objectContaining({
      summary: "foo-bar",
      releases: [
        { name: "pkg-a", type: "minor" },
        { name: "pkg-b", type: "minor" },
      ],
    })
  );
  // @ts-ignore
  jest.unmock("../../../utils/versionablePackages");
});
