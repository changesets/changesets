import { afterEach, describe, expect, test, vi } from "vitest";
import { cli } from "./cli.ts";
import { add } from "./commands/add/index.ts";
import { gitTag } from "./commands/git-tag/index.ts";
import { init } from "./commands/init/index.ts";
import { pack } from "./commands/pack/index.ts";
import { pre } from "./commands/pre/index.ts";
import { publishPlan } from "./commands/publish-plan/index.ts";
import { publish } from "./commands/publish/index.ts";
import { stage } from "./commands/stage/index.ts";
import { status } from "./commands/status/index.ts";
import { version } from "./commands/version/index.ts";

vi.mock("./commands/init/index.ts");
vi.mock("./commands/add/index.ts");
vi.mock("./commands/version/index.ts");
vi.mock("./commands/publish/index.ts");
vi.mock("./commands/stage/index.ts");
vi.mock("./commands/publish-plan/index.ts");
vi.mock("./commands/pack/index.ts");
vi.mock("./commands/status/index.ts");
vi.mock("./commands/git-tag/index.ts");
vi.mock("./commands/pre/index.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

interface CommandTest {
  command: string;
  fn: (...args: any[]) => unknown;
  cases: CommandCase[];
}

interface CommandCase {
  args: string[];
  options: Record<string, unknown>;
  env?: Record<string, string>;
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
      {
        args: [
          "--major",
          "pkg-a",
          "--minor",
          "pkg-b",
          "--patch",
          "pkg-c",
          "--patch",
          "pkg-d",
        ],
        options: {
          major: ["pkg-a"],
          minor: ["pkg-b"],
          patch: ["pkg-c", "pkg-d"],
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
        options: {},
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
        args: ["--from-pack-dir", ".packed"],
        options: {
          fromPackDir: ".packed",
        },
      },
      {
        args: [],
        env: {
          CHANGESETS_OUTPUT: "output.ndjson",
        },
        options: {
          output: "output.ndjson",
        },
      },
      {
        args: ["--stage"],
        options: { stage: true },
      },
      {
        args: ["--no-stage"],
        options: { stage: false },
      },
    ],
  },
  {
    command: "stage",
    fn: stage,
    cases: [
      {
        args: [
          "approve",
          "1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
          "2de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
          "--otp",
          "123456",
          "--registry",
          "https://registry.example.com",
        ],
        options: {
          operation: "approve",
          ids: [
            "1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
            "2de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f",
          ],
          otp: "123456",
          registry: "https://registry.example.com",
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
        args: [
          "--from-publish-plan",
          "publish-plan.json",
          "--out-dir",
          ".packed",
        ],
        options: {
          fromPublishPlan: "publish-plan.json",
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
    command: "git-tag",
    fn: gitTag,
    cases: [
      {
        args: [],
        options: {},
      },
      {
        args: [],
        env: {
          CHANGESETS_OUTPUT: "output.ndjson",
        },
        options: {
          output: "output.ndjson",
        },
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
    for (const { args, options, env } of cases) {
      test(`${args.join(" ") || "<no args>"}`, async () => {
        vi.clearAllMocks();
        if (env) {
          for (const [name, value] of Object.entries(env)) {
            vi.stubEnv(name, value);
          }
        }
        cli.parse(["node", "changeset", command, ...args], { run: false });
        await cli.runMatchedCommand();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(options);
      });
    }
  });
}
