export type TwoFactorState = {
  token: string | undefined;
  isRequired: boolean;
  allowConcurrency?: boolean;
};
