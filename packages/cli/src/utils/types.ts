export type TwoFactorState = {
  token: string | null;
  isRequired: Promise<boolean>;
  mode: "none" | "classic" | "web";
  webAuthUrls?: { authUrl: string; doneUrl: string };
};
