import npmFetch from "npm-registry-fetch";
import { setTimeout } from "node:timers/promises";

interface WebAuthUrls {
  authUrl: string;
  doneUrl: string;
}

export interface ProbeResult {
  type: "none" | "classic" | "web";
  webAuthUrls?: WebAuthUrls;
}

export async function probeOtpRequirement(
  registry: string
): Promise<ProbeResult> {
  try {
    await npmFetch.json("/-/v1/login", {
      method: "POST",
      registry,
      body: {},
    });
    return { type: "none" };
  } catch (err: any) {
    if (err.code === "EOTP") {
      if (err.body?.authUrl && err.body?.doneUrl) {
        return {
          type: "web",
          webAuthUrls: {
            authUrl: err.body.authUrl,
            doneUrl: err.body.doneUrl,
          },
        };
      }
      return { type: "classic" };
    }

    if (err.statusCode >= 400 && err.statusCode < 500) {
      const content = err.body;
      if (content?.loginUrl && content?.doneUrl) {
        return {
          type: "web",
          webAuthUrls: {
            authUrl: content.loginUrl,
            doneUrl: content.doneUrl,
          },
        };
      }
    }

    return { type: "none" };
  }
}

export async function initiateWebAuth(
  registry: string
): Promise<WebAuthUrls | undefined> {
  try {
    const content = await npmFetch.json("/-/v1/login", {
      method: "POST",
      registry,
      body: {},
    });

    if (
      typeof content.loginUrl === "string" &&
      typeof content.doneUrl === "string"
    ) {
      return {
        authUrl: content.loginUrl,
        doneUrl: content.doneUrl,
      };
    }
  } catch (err: any) {
    if (
      typeof err.body?.loginUrl === "string" &&
      typeof err.body?.doneUrl === "string"
    ) {
      return {
        authUrl: err.body.loginUrl,
        doneUrl: err.body.doneUrl,
      };
    }
  }

  return undefined;
}

export async function pollForWebAuthToken(
  doneUrl: string,
  timeoutMs: number = 5 * 60 * 1000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const res = await fetch(doneUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (res.status === 200) {
      const content = await res.json();
      if (!content.token) {
        throw new Error("Invalid response from web auth: missing token");
      }
      return content.token;
    }

    if (res.status === 202) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
      await setTimeout(waitMs);
      continue;
    }

    throw new Error(
      `Unexpected response from web auth: ${res.status} ${res.statusText}`
    );
  }

  throw new Error("Web authentication timed out");
}
