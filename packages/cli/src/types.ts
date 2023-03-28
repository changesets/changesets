export type CliOptions = {
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
  major?: string | string[];
  minor?: string | string[];
  patch?: string | string[];
  message?: string;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
