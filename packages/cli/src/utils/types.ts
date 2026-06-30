export type AuthState = {
  otpToken: string | undefined;
  /** Indicates if interactive authentication (prompt-based) is required */
  requiresInteractive: boolean;
};
