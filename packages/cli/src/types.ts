import { AccessType } from "@changesets/types";

export type CliOptions = {
  commit?: boolean;
  changelog?: string;
  access?: AccessType;
  sinceMaster?: boolean;
  verbose?: boolean;
  output?: string;
  otp?: string;
  empty?: boolean;
  since?: string;
  ignore?: string | string[];
  snapshot?: string | boolean;
  tag?: string;
  workspaceVersionsOnly?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
