import { info } from "@changesets/logger";
import fetch from "node-fetch";
import open from "open";
import pc from "picocolors";
import { askConfirm } from "../../utils/cli-utilities";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface WebAuthUrls {
  authUrl: string;
  doneUrl: string;
}

interface WebAuthResult {
  token: string;
}

const isValidHttpUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

async function pollForAuthCompletion(
  doneUrl: string,
  signal: AbortSignal
): Promise<WebAuthResult> {
  while (!signal.aborted) {
    const res = await fetch(doneUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    });
    const content: unknown = await res.json();

    if (res.status === 200) {
      if (
        !content ||
        typeof content !== "object" ||
        !("token" in content) ||
        typeof content.token !== "string"
      ) {
        throw new Error("Invalid response from web login: missing token");
      }
      return { token: content.token };
    }

    if (res.status === 202) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;
      await sleep(Math.max(retryAfterMs, 1000));
      continue;
    }

    throw new Error(
      `Unexpected response from web login: ${res.status} ${res.statusText}`
    );
  }

  throw new Error("Web authentication was aborted");
}

export async function webAuthOpener(urls: WebAuthUrls): Promise<WebAuthResult> {
  const { authUrl, doneUrl } = urls;

  if (!isValidHttpUrl(authUrl) || !isValidHttpUrl(doneUrl)) {
    throw new Error("Invalid authentication URLs received from registry");
  }

  info(
    `\nThis operation requires authentication via your browser.\n` +
      `Authentication URL: ${pc.cyan(authUrl)}\n`
  );

  const shouldOpen = await askConfirm("Open browser to authenticate?");

  if (!shouldOpen) {
    throw new Error("Web authentication cancelled by user");
  }

  const abortController = new AbortController();
  const { signal } = abortController;

  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, TIMEOUT_MS);

  try {
    info("Opening browser... Complete authentication to continue.");

    const [, authResult] = await Promise.all([
      open(authUrl).catch((err) => {
        // If browser fails to open, user can still navigate manually
        if (err.name !== "AbortError") {
          info(
            pc.yellow(
              `Could not open browser automatically. Please open this URL manually:\n${authUrl}`
            )
          );
        }
      }),
      pollForAuthCompletion(doneUrl, signal).then((result) => {
        abortController.abort(); // Stop any pending operations
        return result;
      }),
    ]);

    info(pc.green("Authentication successful!"));
    return authResult;
  } finally {
    clearTimeout(timeoutId);
  }
}
