export type CliOptions = {
  commit?: boolean;
  changelog?: string;
  access?: "public" | "private";
  sinceMaster?: boolean;
  verbose?: boolean;
  output?: string;
  otp?: string;
  empty?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
