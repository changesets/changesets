export type CliOptions = {
  verbose?: boolean;
  output?: string;
  otp?: string;
  empty?: boolean;
  since?: string;
  ignore?: string | string[];
  message?: string;
  snapshot?: string | boolean;
  snapshotPrereleaseTemplate?: string;
  tag?: string;
  gitTag?: boolean;
  open?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
