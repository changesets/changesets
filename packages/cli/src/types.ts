export type CliOptions = {
  sinceMaster?: boolean;
  verbose?: boolean;
  output?: string;
  otp?: string;
  empty?: boolean;
  since?: string;
  ignore?: string | string[];
  snapshot?: string | boolean;
  tag?: string;
  gitTag?: boolean;
  json?: boolean;
  open?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
