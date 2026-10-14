import type { Packages } from "@changesets/types";
import type { detect } from "package-manager-detector/detect";
import * as bun from "../../lib/bun.ts";
import { getPublishTool } from "./getPublishTool.ts";

declare const vi: typeof import("vitest").vi;
declare const it: typeof import("vitest").it;
declare const expect: typeof import("vitest").expect;
declare const beforeEach: typeof import("vitest").beforeEach;

const { mockedDetect } = vi.hoisted(() => ({
  mockedDetect: vi.fn<typeof detect>(),
}));
vi.mock("package-manager-detector/detect", () => ({ detect: mockedDetect }));

const packages = {
  rootDir: "/workspace",
  packages: [],
  tool: { type: "bun" },
} satisfies Packages;

beforeEach(() => mockedDetect.mockReset());

it("selects Bun directly when manypkg recognizes its workspace", async () => {
  await expect(getPublishTool(packages)).resolves.toBe(bun);
  expect(mockedDetect).not.toHaveBeenCalled();
});

it("selects Bun from the package manager detector for a root package", async () => {
  mockedDetect.mockResolvedValue({
    name: "bun",
    agent: "bun",
    version: "1.3.1",
  });
  await expect(
    getPublishTool({ ...packages, tool: { type: "root" } }),
  ).resolves.toBe(bun);
  expect(mockedDetect).toHaveBeenCalledWith({ cwd: packages.rootDir });
});
