const strfy = (obj: unknown) => JSON.stringify(obj, null, 2);

type Snapshot = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type SnapshotCollection = Record<"npm" | "pnpm", Record<string, Snapshot>>;

export const alreadyPublishedErrorSnapshot = {
  npm: {
    v10: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          code: "E403",
          summary:
            "403 Forbidden - PUT https://registry.npmjs.org/[name] - You cannot publish over the previously published versions: [current-version].",
          detail:
            "In most cases, you or one of your dependencies are requesting\\na package version that is forbidden by your security policy, or\\non a server you do not have access to.",
        },
      }),
    },

    v11: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          summary:
            "You cannot publish over the previously published versions: [current-version].",
          detail: "",
        },
      }),
    },
  },

  pnpm: {
    v10: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          summary:
            "You cannot publish over the previously published versions: [current-version].",
          detail: "",
        },
      }),
    },

    v11: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          code: "E403",
          message:
            "403 Forbidden - PUT https://registry.npmjs.org/[name] - You cannot publish over the previously published versions: [current-version].",
        },
      }),
    },
  },
} satisfies SnapshotCollection as SnapshotCollection;

export const need2faErrorSnapshot = {
  npm: {
    v10: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          code: "EOTP",
          summary:
            "This operation requires a one-time password from your authenticator.",
          detail:
            "You can provide a one-time password by passing --otp=<code> to the command you ran.\\nIf you already provided a one-time password then it is likely that you either typoed\\nit, or it timed out. Please try again.",
        },
      }),
    } satisfies Snapshot,

    v11: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          code: "EOTP",
          summary: "This operation requires a one-time password.",
          detail:
            "Open this URL in your browser to authenticate:\\n  https://www.npmjs.com/auth/cli/[uuid]\\n\\nAfter authenticating, your token can be retrieved from:\\n  https://registry.npmjs.org/-/v1/done?authId=[uuid]",
          authUrl: "https://www.npmjs.com/auth/cli/[uuid]",
          doneUrl: "https://registry.npmjs.org/-/v1/done?authId=[uuid]",
        },
      }),
    } satisfies Snapshot,
  },

  pnpm: {
    v10: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          code: "EOTP",
          summary: "This operation requires a one-time password.",
          detail:
            "Open this URL in your browser to authenticate:/n  https://www.npmjs.com/auth/cli/[uuid]/n/nAfter authenticating, your token can be retrieved from:/n  https://registry.npmjs.org/-/v1/done?authId=[uuid]",
          authUrl: "https://www.npmjs.com/auth/cli/[uuid]",
          doneUrl: "https://registry.npmjs.org/-/v1/done?authId=[uuid]",
        },
      }),
    } satisfies Snapshot,

    // v11.10+ only
    v11: {
      exitCode: 1,
      stderr: "",
      stdout: strfy({
        error: {
          code: "ERR_PNPM_OTP_NON_INTERACTIVE",
          message:
            "The registry requires additional authentication, but pnpm is not running in an interactive terminal",
          authUrl: "https://www.npmjs.com/auth/cli/[uuid]",
          doneUrl: "https://registry.npmjs.org/-/v1/done?authId=[uuid]",
        },
      }),
    } satisfies Snapshot,
  },
} satisfies SnapshotCollection;
