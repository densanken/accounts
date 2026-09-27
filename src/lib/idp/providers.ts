// Fixed list of Providers the Connections screen offers linking for, so an
// unlinked one still gets a "Connect" row.
export const LINK_PROVIDERS = ["discord", "github", "google"] as const;

export type LinkProvider = (typeof LINK_PROVIDERS)[number];

const providerLabels: Record<LinkProvider, string> = {
  discord: "Discord",
  github: "GitHub",
  google: "Google",
};

// `provider` is a plain string from the IdP, so an unknown one falls back
// to itself instead of indexing out of bounds.
export const providerLabel = (provider: string): string =>
  providerLabels[provider as LinkProvider] ?? provider;

// Shared so the disabled-row hint and the unlink error describe the same
// IdP rule the same way.
export const LAST_DISCORD_ACCOUNT_MESSAGE = "1件以上連携させる必要があります。";
