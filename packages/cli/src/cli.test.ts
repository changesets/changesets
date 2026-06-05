import { describe, expect, test, vi } from "vitest";
import { cli } from "./cli.ts";
import { add } from "./commands/add/index.ts";
import { init } from "./commands/init/index.ts";
import { pack } from "./commands/pack/index.ts";
import { pre } from "./commands/pre/index.ts";
import { publishPlan } from "./commands/publish-plan/index.ts";
import { publish } from "./commands/publish/index.ts";
import { status } from "./commands/status/index.ts";
import { tag } from "./commands/tag/index.ts";
import { version } from "./commands/version/index.ts";

vi.mock("./commands/init/index.ts");
vi.mock("./commands/add/index.ts");
vi.mock("./commands/version/index.ts");
vi.mock("./commands/publish/index.ts");
vi.mock("./commands/publish-plan/index.ts");
vi.mock("./commands/pack/index.ts");
vi.mock("./commands/status/index.ts");
vi.mock("./commands/tag/index.ts");
vi.mock("./commands/pre/index.ts");

interface CommandTest {
  command: string;
  fn: (...args: any[]) => unknown;
  cases: CommandCase[];
}

interface CommandCase {
  args: string[];
  options: Record<string, unknown>;
}

const tests: CommandTest[] = [
  {
    command: "init",
    fn: init,
    cases: [
      {
        args: [],
        options: {},
      },
    ],
  },
  {
    command: "add",
    fn: add,
    cases: [
      {
        args: [],
        options: {},
      },
      {
        args: ["--empty", "--open", "--since", "main", "-m", "hello"],
        options: {
          empty: true,
          open: true,
          since: "main",
          message: "hello",
        },
      },
      {
        args: ["--since", "main", "--since", "next"],
        options: {
          since: "next",
        },
      },
    ],
  },
  {
    command: "version",
    fn: version,
    cases: [
      {
        args: [],
        options: {},
      },
      {
        args: ["--ignore", "pkg-a", "--ignore", "pkg-b"],
        options: {
          ignore: ["pkg-a", "pkg-b"],
        },
      },
      {
        args: ["--snapshot"],
        options: {
          snapshot: true,
        },
      },
      {
        args: [
          "--snapshot",
          "pr-123",
          "--snapshot-prerelease-template",
          "{tag}-{commit}",
        ],
        options: {
          snapshot: "pr-123",
          snapshotPrereleaseTemplate: "{tag}-{commit}",
        },
      },
    ],
  },
  {
    command: "publish",
    fn: publish,
    cases: [
      {
        args: [],
        options: { gitTag: true },
      },
      {
        args: ["--no-git-tag"],
        options: { gitTag: false },
      },
      {
        args: ["--otp", "123456", "--tag", "beta", "--git-tag"],
        options: {
          otp: "123456",
          tag: "beta",
          gitTag: true,
        },
      },
      {
        args: ["--from", "changesets-pack.tgz"],
        options: {
          from: "changesets-pack.tgz",
          gitTag: true,
        },
      },
    ],
  },
  {
    command: "publish-plan",
    fn: publishPlan,
    cases: [
      {
        args: [],
        options: {},
      },
      {
        args: ["--output", "publish-plan.json"],
        options: {
          output: "publish-plan.json",
        },
      },
    ],
  },
  {
    command: "pack",
    fn: pack,
    cases: [
      {
        args: ["--out-dir", ".packed"],
        options: {
          outDir: ".packed",
        },
      },
      {
        args: ["--from-plan", "publish-plan.json", "--out-dir", ".packed"],
        options: {
          fromPlan: "publish-plan.json",
          outDir: ".packed",
        },
      },
    ],
  },
  {
    command: "status",
    fn: status,
    cases: [
      {
        args: [],
        options: {},
      },
      {
        args: ["--since", "main", "--verbose", "--output", "status.json"],
        options: {
          since: "main",
          verbose: true,
          output: "status.json",
        },
      },
      {
        args: ["-v", "-o", "status.json"],
        options: {
          verbose: true,
          output: "status.json",
        },
      },
    ],
  },
  {
    command: "tag",
    fn: tag,
    cases: [
      {
        args: [],
        options: {},
      },
    ],
  },
  {
    command: "pre",
    fn: pre,
    cases: [
      {
        args: ["enter", "beta"],
        options: {
          command: "enter",
          tag: "beta",
        },
      },
    ],
  },
  {
    command: "pre",
    fn: pre,
    cases: [
      {
        args: ["exit"],
        options: {
          command: "exit",
        },
      },
    ],
  },
];

for (const { command, fn, cases } of tests) {
  describe(`changeset ${command}`, () => {
    for (const { args, options } of cases) {
      test(`${args.join(" ") || "<no args>"}`, async () => {
        vi.clearAllMocks();
        cli.parse(["node", "changeset", command, ...args], { run: false });
        await cli.runMatchedCommand();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(options);
      });
    }
  });
}
