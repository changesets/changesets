import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { unpackTar } from "modern-tar";
import { exec } from "tinyexec";
import {
  AbortableAsyncDisposableStack,
  createPkgAFixture,
  createPmBinEnv,
  getPmBinPath,
  pmCases,
  runCliCommand,
} from "./e2e-utils.ts";

const bunCases = pmCases.filter((pm) => "bun" in pm.bins);
const token = "bun-ci-test-token";
const plan = JSON.stringify({
  version: 1,
  plan: [
    [
      {
        kind: "publish",
        name: "pkg-a",
        version: "1.0.0",
        access: "public",
        tag: "next",
      },
    ],
  ],
});

async function readPackedManifest(tarball: Uint8Array) {
  const entries = await unpackTar(gunzipSync(tarball));
  const entry = entries.find(
    ({ header }) => header.name === "package/package.json",
  );
  assert(entry?.data, "Tarball must contain package/package.json");
  return JSON.parse(new TextDecoder().decode(entry.data)) as Record<
    string,
    unknown
  >;
}

async function createRegistry() {
  const uploads: Array<{
    authorization: string | undefined;
    body: {
      _attachments: Record<string, { data: string }>;
      "dist-tags": Record<string, string>;
    };
  }> = [];
  const server = http.createServer((request, response) => {
    if (request.method !== "PUT") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const authorization = request.headers.authorization;
      const body = JSON.parse(
        Buffer.concat(chunks).toString(),
      ) as (typeof uploads)[number]["body"];
      uploads.push({ authorization, body });
      const authorized = authorization === `Bearer ${token}`;
      response.writeHead(authorized ? 201 : 401, {
        "content-type": "application/json",
      });
      response.end(
        JSON.stringify(
          authorized ? { ok: true } : { error: "Invalid authentication token" },
        ),
      );
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const host = `127.0.0.1:${address.port}`;
  return {
    url: `http://${host}/`,
    host,
    uploads,
    async [Symbol.asyncDispose]() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

describe.each(bunCases)("$name workspace packing", (pm) => {
  it("uses refreshed workspace versions in the tarball and preserves source manifests", async ({
    signal,
  }) => {
    await using stack = new AbortableAsyncDisposableStack(signal);
    const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
    const manifest = JSON.stringify({
      name: "pkg-a",
      version: "1.0.0",
      files: ["index.js"],
      dependencies: { "pkg-b": "workspace:*" },
      devDependencies: { "pkg-b": "workspace:^" },
      peerDependencies: { "pkg-b": "workspace:~" },
      optionalDependencies: { "pkg-b": "workspace:^2.0.0" },
    });
    const cwd = await pm.gitdir(
      { pmBinPath },
      {
        ...createPkgAFixture(),
        "packages/pkg-a/package.json": manifest,
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "2.3.4",
        }),
        "publish-plan.json": plan,
      },
    );
    // Reproduce the manifest update performed during versioning, after install.
    await fs.writeFile(
      path.join(cwd, "packages/pkg-b/package.json"),
      JSON.stringify({ name: "pkg-b", version: "2.4.0" }),
    );
    const staleResult = await runCliCommand({
      command: "pack",
      args: ["--from-publish-plan", "publish-plan.json", "--out-dir", ".stale"],
      cwd,
      pmBinPath,
      signal,
    });
    expect(staleResult.exitCode).toBe(0);
    const stale = await readPackedManifest(
      await fs.readFile(path.join(cwd, ".stale/packages/pkg-a-1.0.0.tgz")),
    );
    expect(stale.dependencies).toEqual({ "pkg-b": "2.3.4" });
    const refreshed = await exec(
      "bun",
      ["install", "--lockfile-only", "--ignore-scripts"],
      {
        nodePath: false,
        nodeOptions: { cwd, env: await createPmBinEnv(cwd, pmBinPath) },
        signal,
      },
    );
    expect(refreshed.exitCode).toBe(0);

    const result = await runCliCommand({
      command: "pack",
      args: [
        "--from-publish-plan",
        "publish-plan.json",
        "--out-dir",
        ".packed",
      ],
      cwd,
      pmBinPath,
      signal,
    });
    expect(result.exitCode).toBe(0);
    const packed = await readPackedManifest(
      await fs.readFile(path.join(cwd, ".packed/packages/pkg-a-1.0.0.tgz")),
    );
    expect(packed).toMatchObject({
      dependencies: { "pkg-b": "2.4.0" },
      devDependencies: { "pkg-b": "^2.4.0" },
      peerDependencies: { "pkg-b": "~2.4.0" },
      optionalDependencies: { "pkg-b": "^2.0.0" },
    });
    expect(
      await fs.readFile(path.join(cwd, "packages/pkg-a/package.json"), "utf8"),
    ).toBe(manifest);
  });

  it("fails packing unresolved shorthand when the lockfile is missing", async ({
    signal,
  }) => {
    await using stack = new AbortableAsyncDisposableStack(signal);
    const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
    const cwd = await pm.gitdir(
      { pmBinPath },
      {
        ...createPkgAFixture(),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          dependencies: { "pkg-b": "workspace:*" },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "2.3.4",
        }),
      },
    );
    await fs.rm(path.join(cwd, "bun.lock"));
    // Invoke Bun directly because manypkg also needs the lockfile to discover
    // the workspace. The adapter's error propagation is covered in unit tests.
    const result = await exec(
      "bun",
      ["pm", "pack", "--filename", path.join(cwd, "pkg-a.tgz")],
      {
        nodePath: false,
        nodeOptions: {
          cwd: path.join(cwd, "packages/pkg-a"),
          env: await createPmBinEnv(cwd, pmBinPath),
        },
        signal,
      },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Failed to resolve workspace version");
    expect(result.stderr).toContain("bun install");
  });
});

describe.each(bunCases)("$name CI authentication", (pm) => {
  it.for([
    "NPM_CONFIG_TOKEN",
    "project .npmrc",
    "NPM_TOKEN only",
    "NODE_AUTH_TOKEN only",
  ])(
    "publishes artifacts using %s and reports tags only after success",
    async (auth, { signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(await createRegistry());
      const cwd = await pm.gitdir(
        { pmBinPath, registry },
        {
          ...createPkgAFixture(),
          "publish-plan.json": plan,
          ...(auth === "project .npmrc"
            ? {
                ".npmrc": `registry=${registry.url}\n//${registry.host}/:_authToken=\${NPM_TOKEN}\n`,
              }
            : {}),
        },
      );
      const packed = await runCliCommand({
        command: "pack",
        args: [
          "--from-publish-plan",
          "publish-plan.json",
          "--out-dir",
          ".packed",
        ],
        cwd,
        pmBinPath,
        signal,
      });
      expect(packed.exitCode).toBe(0);
      const env = {
        CI: "true",
        CHANGESETS_OUTPUT: path.join(cwd, "published.ndjson"),
        ...(auth === "NPM_CONFIG_TOKEN"
          ? { NPM_CONFIG_TOKEN: token }
          : auth === "NODE_AUTH_TOKEN only"
            ? { NODE_AUTH_TOKEN: token }
            : { NPM_TOKEN: token }),
      };
      const result = await runCliCommand({
        command: "publish",
        args: ["--from-pack-dir", ".packed"],
        cwd,
        env,
        pmBinPath,
        signal,
      });
      const succeeds = auth === "NPM_CONFIG_TOKEN" || auth === "project .npmrc";
      expect(result.exitCode).toBe(succeeds ? 0 : 1);
      const output = await fs.readFile(
        path.join(cwd, "published.ndjson"),
        "utf8",
      );
      const uploads = await Promise.all(
        registry.uploads.map(async (upload) => {
          const [attachment] = Object.values(upload.body._attachments);
          return {
            authorization: upload.authorization,
            tags: upload.body["dist-tags"],
            manifest: await readPackedManifest(
              Buffer.from(attachment.data, "base64"),
            ),
          };
        }),
      );
      const expectedUpload = expect.objectContaining({
        authorization: `Bearer ${token}`,
        tags: { next: "1.0.0" },
        manifest: expect.objectContaining({ name: "pkg-a", version: "1.0.0" }),
      });
      expect(uploads).toEqual(succeeds ? [expectedUpload] : []);
      const events = output
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      expect(events).toEqual(
        succeeds
          ? [
              {
                type: "git-tag",
                tag: "pkg-a@1.0.0",
                packageName: "pkg-a",
              },
            ]
          : [],
      );
    },
  );
});
