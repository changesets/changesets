export type AuthState = {
  otpCode: string | undefined;
  /** Indicates if interactive authentication (prompt-based) is required */
  requiresInteractive: boolean;
};
