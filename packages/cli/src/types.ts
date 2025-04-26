export type CliOptions = {
  verbose?: boolean;
  output?: string;
  otp?: string;
  empty?: boolean;
  since?: string;
  ignore?: string | string[];
  snapshot?: string | boolean;
  snapshotPrereleaseTemplate?: string;
  prettier?: boolean;
  tag?: string;
  gitTag?: boolean;
  open?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
