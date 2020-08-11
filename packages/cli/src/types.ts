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
  /**
   * When `true` the versioning command will include a date timestamp.
   *
   * The date is automatically set to the date the version command is being run
   * at. See the link below for reasons on why this might be problematic.
   *
   * https://github.com/atlassian/changesets/issues/109#issuecomment-642491488
   */
  date?: boolean;
};

export type CommandOptions = CliOptions & {
  cwd: string;
};
