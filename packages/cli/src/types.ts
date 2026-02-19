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
  prettier?: boolean;
  tag?: string;
  gitTag?: boolean;
  open?: boolean;
  allChanged?: boolean;
  major?: boolean;
  minor?: boolean;
  patch?: boolean;
  summary?: string;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
