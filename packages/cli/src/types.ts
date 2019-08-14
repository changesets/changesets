export type CliOptions = {
  commit?: boolean;
  updateChangelog?: boolean;
  skipCI?: boolean;
  public?: boolean;
  sinceMaster?: boolean;
  verbose?: boolean;
  output?: string;
  otp?: string;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
