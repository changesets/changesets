import type { Packages } from "@changesets/types";
import type { detect } from "package-manager-detector/detect";
import type { exec } from "tinyexec";
import * as bun from "../../lib/bun.ts";
import * as npm from "../../lib/npm.ts";
import * as pnpm from "../../lib/pnpm.ts";
import type { PublishOptions } from "../../lib/types.ts";
import * as yarn from "../../lib/yarn.ts";
import { getPublishTool } from "./getPublishTool.ts";

declare const vi: typeof import("vitest").vi;
declare const it: typeof import("vitest").it;
declare const expect: typeof import("vitest").expect;
declare const beforeEach: typeof import("vitest").beforeEach;

const { mockedDetect, mockedExec } = vi.hoisted(() => ({
  mockedDetect: vi.fn<typeof detect>(),
  mockedExec: vi.fn<typeof exec>(),
}));
vi.mock("package-manager-detector/detect", () => ({ detect: mockedDetect }));
vi.mock("tinyexec", () => ({ exec: mockedExec }));

const packages = {
  rootDir: "/workspace",
  packages: [],
  tool: { type: "bun" },
} satisfies Packages;

beforeEach(() => {
  mockedDetect.mockReset();
  mockedExec.mockReset();
});

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

it("selects npm directly without probing package-manager detection", async () => {
  await expect(
    getPublishTool({ ...packages, tool: { type: "npm" } }),
  ).resolves.toBe(npm);
  expect(mockedDetect).not.toHaveBeenCalled();
});

it("falls back to npm when package-manager detection returns nothing", async () => {
  mockedDetect.mockResolvedValue(null);
  await expect(
    getPublishTool({ ...packages, tool: { type: "root" } }),
  ).resolves.toBe(npm);
});

it.each(["1.22.22", "0.27.5"])(
  "rejects unsupported Yarn Classic %s",
  async (version) => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: `${version}\n`,
      stderr: "",
    });
    await expect(
      getPublishTool({ ...packages, tool: { type: "yarn" } }),
    ).rejects.toThrow("Yarn Classic is not supported");
  },
);

it.each(["2.4.3", "4.5.2", "invalid"])(
  "selects Yarn Berry for version output %s",
  async (version) => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: `${version}\n`,
      stderr: "",
    });
    await expect(
      getPublishTool({ ...packages, tool: { type: "yarn" } }),
    ).resolves.toBe(yarn);
    expect(mockedExec).toHaveBeenCalledWith("yarn", ["--version"], {
      nodePath: false,
      nodeOptions: { cwd: packages.rootDir },
    });
    expect(mockedDetect).not.toHaveBeenCalled();
  },
);

it.each([10, 11, 12])(
  "passes pnpm major %i to info, packing, and publishing",
  async (major) => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: `${major}.0.0\n`,
      stderr: "",
    });
    const tool = await getPublishTool({ ...packages, tool: { type: "pnpm" } });
    const pkg = {
      dir: "/workspace/packages/pkg-a",
      packageJson: { name: "pkg-a", version: "1.0.0" },
    };
    const infoOptions = { cwd: packages.rootDir, pkg };
    const packOptions = {
      pkg,
      packDir: pkg.dir,
      outputDir: "/artifacts",
      tarballPath: "/artifacts/pkg-a.tgz",
    };
    const publishOptions: PublishOptions = {
      pkg,
      release: {
        kind: "publish",
        name: "pkg-a",
        version: "1.0.0",
        access: "public",
        tag: "latest",
      },
      tarballPath: null,
      interactive: false,
      otpCode: null,
    };
    const info = vi.spyOn(pnpm, "info").mockResolvedValue({ published: false });
    const pack = vi
      .spyOn(pnpm, "pack")
      .mockResolvedValue({ tarballPath: packOptions.tarballPath });
    const publish = vi.spyOn(pnpm, "publish").mockResolvedValue({
      name: "pkg-a",
      version: "1.0.0",
      result: "published",
    });
    expect(tool.name).toBe("pnpm");
    expect(tool.getOtpCode("123456")).toBe("123456");
    await expect(tool.info(infoOptions)).resolves.toEqual({ published: false });
    await expect(tool.pack(packOptions)).resolves.toEqual({
      tarballPath: packOptions.tarballPath,
    });
    await expect(tool.publish(publishOptions)).resolves.toMatchObject({
      result: "published",
    });
    expect(info).toHaveBeenCalledWith(infoOptions, { major });
    expect(pack).toHaveBeenCalledWith(packOptions, { major });
    expect(publish).toHaveBeenCalledWith(publishOptions, { major });
    expect(mockedExec).toHaveBeenCalledWith("pnpm", ["--version"], {
      nodePath: false,
      nodeOptions: { cwd: packages.rootDir },
    });
    expect(mockedDetect).not.toHaveBeenCalled();
  },
);
