export type CliOptions = {
  all?: boolean;
  allChanged?: boolean;
  allUnchanged?: boolean;
  message?: string;
  recommend?: boolean;
  yes?: boolean;
  sinceMaster?: boolean;
  verbose?: boolean;
  output?: string;
  otp?: string;
  empty?: boolean;
  since?: string;
  ignore?: string | string[];
  snapshot?: string | boolean;
  snapshotPrereleaseTemplate?: string;
  tag?: string;
  gitTag?: boolean;
  open?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
