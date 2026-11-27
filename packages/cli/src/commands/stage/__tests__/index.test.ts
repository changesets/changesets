import { testdir } from "@changesets/test-utils";
import { exec } from "tinyexec";
import { describe, expect, it, vi } from "vitest";
import { stage } from "../index.ts";

vi.mock("tinyexec");
const mockedExec = vi.mocked(exec);

const ids = [
  "1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
  "2de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
  "3de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
];

describe("stage", () => {
  it("processes ids sequentially with auth and registry options", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({ name: "root", private: true }),
      "package-lock.json": "",
    });
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    await stage({
      cwd,
      operation: "approve",
      ids: ids.slice(0, 2),
      otp: "123456",
      registry: "https://registry.example.com",
    });

    expect(mockedExec.mock.calls.map((call) => call[1])).toEqual([
      [
        "stage",
        "approve",
        ids[0],
        "--otp",
        "123456",
        "--registry",
        "https://registry.example.com",
      ],
      [
        "stage",
        "approve",
        ids[1],
        "--otp",
        "123456",
        "--registry",
        "https://registry.example.com",
      ],
    ]);
  });

  it("stops at the first failed id", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({ name: "root", private: true }),
      "package-lock.json": "",
    });
    mockedExec
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" });

    await expect(
      stage({ cwd, operation: "reject", ids }),
    ).rejects.toMatchObject({ code: 1 });
    expect(mockedExec).toHaveBeenCalledTimes(2);
  });
});
