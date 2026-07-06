import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";

vi.mock("@changesets/git");

type RegistryRequest = {
  method: string;
  pathname: string;
  authorization?: string;
  npmOtp?: string;
  forwarded: boolean;
  statusCode?: number;
};

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stubIsTTY(value: boolean) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process.stdin,
    "isTTY",
  );
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    ...originalDescriptor,
    value,
  });
  return {
    [Symbol.dispose]() {
      if (originalDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", originalDescriptor);
      } else {
        Reflect.deleteProperty(process.stdin, "isTTY");
      }
    },
  };
}

async function readBody(req: http.IncomingMessage) {
  for await (const _chunk of req) {
    // Drain rejected requests so clients can finish writing cleanly.
  }
}

async function waitForRegistry(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for pnpr at ${url}`, {
    cause: lastError,
  });
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  if (!address || typeof address === "string") {
    throw new Error("Expected temporary server to listen on a TCP port");
  }
  return address.port;
}

async function createPnprRegistry() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "changesets-pnpr-"));
  const storage = path.join(root, "storage");
  const config = path.join(root, "pnpr.yaml");
  // pnpr accepts `--listen 127.0.0.1:0`, but it currently doesn't expose the
  // actual bound port to the parent process, and its default/public tarball
  // URLs are derived from the configured address (`:0`) rather than the bound
  // listener address. Precompute for now so `--public-url` is usable.
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}/`;
  await fs.mkdir(storage);
  await fs.writeFile(
    config,
    `
storage: ${JSON.stringify(storage)}
secret: changesets-test-secret-key-32-bytes
auth:
  htpasswd:
    max_users: 100
registries:
  local:
    type: hosted
    access: $all
    packages:
      "**":
        access: $all
        publish: $all
        unpublish: $all
  main:
    type: router
    sources: [local]
defaultRegistry: main
web:
  enable: false
log:
  type: stdout
  format: pretty
  level: error
`.trimStart(),
  );

  const child = spawn(
    "pnpr",
    [
      "--config",
      config,
      "--listen",
      `127.0.0.1:${port}`,
      "--storage",
      storage,
      "--public-url",
      url,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  await waitForRegistry(url);

  return {
    url,
    async [Symbol.asyncDispose]() {
      child.kill();
      await fs.rm(root, { force: true, recursive: true });
    },
  };
}

async function proxyToPnpr(
  pnprUrl: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<number> {
  const upstream = new URL(req.url ?? "/", pnprUrl);

  return new Promise((resolve) => {
    const proxyReq = http.request(
      upstream,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: upstream.host,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers);
        proxyRes.pipe(res);
        proxyRes.on("end", () => resolve(proxyRes.statusCode ?? 500));
      },
    );
    proxyReq.on("error", (error) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
      resolve(502);
    });
    req.pipe(proxyReq);
  });
}

async function createAuthProxy(pnprUrl: string) {
  const requests: RegistryRequest[] = [];
  let publishAttempts = 0;

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://registry.test");
      const request: RegistryRequest = {
        method: req.method ?? "GET",
        pathname: decodeURIComponent(url.pathname),
        authorization: firstHeader(req.headers.authorization),
        npmOtp: firstHeader(req.headers["npm-otp"]),
        forwarded: false,
      };
      requests.push(request);

      if (request.method === "PUT" && request.pathname === "/pkg-a") {
        publishAttempts++;

        if (request.authorization !== "Bearer publish-token") {
          await readBody(req);
          request.statusCode = 401;
          res.writeHead(401, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Unauthorized",
              code: "E401",
              reason: "Invalid authentication token.",
            }),
          );
          return;
        }

        if (publishAttempts === 1) {
          await readBody(req);
          request.statusCode = 401;
          res.writeHead(401, {
            "content-type": "application/json",
            "www-authenticate": "OTP",
          });
          res.end(
            JSON.stringify({
              error: "OTP required",
              code: "EOTP",
              reason:
                "This operation requires a one-time password from your authenticator.",
            }),
          );
          return;
        }
      }

      request.forwarded = true;
      request.statusCode = await proxyToPnpr(pnprUrl, req, res);
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected proxy server to listen on a TCP port");
  }

  return {
    requests,
    url: `http://127.0.0.1:${address.port}/`,
    [Symbol.asyncDispose]: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function createTestRegistry() {
  await using stack = new AsyncDisposableStack();
  const pnpr = stack.use(await createPnprRegistry());
  const proxy = stack.use(await createAuthProxy(pnpr.url));
  const cleanup = stack.move();

  return {
    host: new URL(proxy.url).host,
    requests: proxy.requests,
    url: proxy.url,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
    },
  };
}

describe("publish command auth/publish e2e prototype", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.skip("uses a programmable auth proxy in front of pnpr", async () => {
    await using registry = await createTestRegistry();
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".npmrc": [
        `registry=${registry.url}`,
        `//${registry.host}/:_authToken=publish-token`,
        "always-auth=true",
      ].join("\n"),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        files: ["index.js"],
      }),
      "packages/pkg-a/index.js": "module.exports = 'pkg-a';\n",
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(true);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      registry.requests.filter(
        (request) =>
          request.method === "PUT" && request.pathname === "/pkg-a",
      ),
    ).toEqual([
      expect.objectContaining({
        authorization: "Bearer publish-token",
        forwarded: false,
        npmOtp: undefined,
        statusCode: 401,
      }),
      expect.objectContaining({
        authorization: "Bearer publish-token",
        forwarded: true,
        statusCode: expect.any(Number),
      }),
    ]);

    const response = await fetch(`${registry.url}pkg-a`);
    const packument = await response.json();
    expect(response.status).toBe(200);
    expect(packument).toMatchObject({
      name: "pkg-a",
      versions: {
        "1.0.0": {
          name: "pkg-a",
          version: "1.0.0",
        },
      },
    });
    expect(git.tag).toHaveBeenCalledWith("pkg-a@1.0.0", cwd);
  });
});
