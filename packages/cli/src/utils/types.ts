export type TwoFactorState = {
  token: string | null;
  isRequired: Promise<boolean>;
  allowConcurrency?: boolean;
};
