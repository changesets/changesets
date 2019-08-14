export type CliOptions = {
  commit?: boolean;
  changelog?: string;
  skipCI?: boolean;
  access?: "public" | "private";
  sinceMaster?: boolean;
  verbose?: boolean;
  output?: string;
  otp?: string;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
