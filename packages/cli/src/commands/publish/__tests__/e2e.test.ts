import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { tagExists } from "@changesets/git";
import { gitdir } from "@changesets/test-utils";
import { describe, expect, it } from "vitest";
import {
  AbortableAsyncDisposableStack,
  createPkgAFixture,
  createTestRegistry,
  getPackageTarballFilename,
  getPmBinPath,
  packTarball,
  pmCases,
  runCliCommand,
  setTestGitdir,
  type TestRegistry,
  type TestRegistryConfig,
} from "../../__tests__/e2e-utils.ts";

setTestGitdir(gitdir);

type PackedPackage = {
  name: string;
  version: string;
};

// This token models npmjs-facing auth at the proxy layer. pnpr's own token is still needed upstream.
// We can't reliably use pnpr tokens to check validity at publish time (read and write accesses can be configured differently).
// We could get away with just using matching read/write $authenticated settings, but
// - pnpr /GET can't reliably distinguish between "missing package" + "bad token"/"good token"
// - it doesn't seem to even validate the tokens for existing packages.
const CLIENT_AUTH_TOKEN = "publ1sh-t0k3n";
const BAD_CLIENT_AUTH_TOKEN = "wr0ng-t0k3n";

function normalizeOtpPrompts(message: string) {
  return (
    message
      // Yarn redraws the completed prompt on the same terminal line.
      .replace(
        /^[?√] One-time password:[^\n]*?(?=(➤ YN)|$)/gm,
        (_match, continuedOutput: string | undefined) =>
          `? One-time password: [prompt]${continuedOutput ? "\n\n" : ""}`,
      )
      // pnpm redraws the prompt after every entered digit.
      .replace(
        /Enter OTP:[^\n]*?(?:\?|✔) This operation requires a one-time password\.(?:\n|(?=Enter OTP:))/g,
        "",
      )
      // npm may render the prompt and entered code on separate terminal lines.
      .replace(/Enter OTP:(?:\n[ \t]*)+(\d{6})/g, "Enter OTP: $1")
      // npm 10 may concatenate the following publish result onto the prompt.
      .replace(/(Enter OTP: \d{6})(?=\+ )/g, "$1\n\n")
  );
}

function sanitizePublishLog(message: unknown, registryUrl: string) {
  const output = stripVTControlCharacters(
    String(message).replace(
      // Strip OSC sequences first because stripVTControlCharacters removes
      // their introducer but leaves the title and terminator behind.
      // eslint-disable-next-line no-control-regex -- OSC sequences are delimited by ESC and BEL control characters.
      /\u001B\](?:[^\u0007\u001B]|\u001B(?!\\))*(?:\u0007|\u001B\\)/g,
      "",
    ),
  )
    // Windows PTYs may duplicate the carriage return in CRLF.
    .replace(/\r+\n/g, "\n")
    // Standalone carriage returns redraw the current line rather than adding
    // a new one. Removing them lets the redraw normalizers below collapse
    // the concatenated terminal states.
    .replaceAll("\r", "")
    .replace(/^npm notice 📦[ \t]+/gm, "npm notice package: ")
    .replace(/changeset v\S+/g, "changeset v[version]")
    .replace(/(➤ YN0000: Done in )\d+s \d+ms/g, "$1[duration]")
    .replace(/^[A-Za-z]:\\(?:[^\\\r\n]+\\)*cmd\.exe \/d \/s \/c /gim, "sh -c ")
    .replace(
      /logs can be found here: .*?\.log/g,
      "logs can be found here: [yarn-prepack-log]",
    )
    .replace(/^npm notice shasum: .+$/gm, "npm notice shasum: [shasum]")
    .replace(
      /^npm notice integrity: .+$/gm,
      "npm notice integrity: [integrity]",
    );

  return normalizeOtpPrompts(output)
    .replaceAll(
      /(?:^[◒◐◓◑•oO0] {2}Creating git tag\.*\n)+(?=^[◇o] {2}Created git tag\.$)/gm,
      "",
    )
    .replaceAll(/^o {2}Created git tag\.$/gm, "◇  Created git tag.")
    .replaceAll(
      /[◒◐◓◑•oO0] {2}(?:(?:━|=)+ )?(Publishing packages|Creating git tags)(?: \(\d+\/\d+\)|\.*)(?:(?:\n[ \t]*)*[◒◐◓◑•oO0] {2}(?:(?:━|=)+ )?\1(?: \(\d+\/\d+\)|\.*))*/g,
      (_match, message: string) => `◒  ${message}`,
    )
    .replaceAll(
      /(?:◒ {2}Publishing packages(?:\n[ \t]*)*)+[◇o] {2}([^\n]*requires 2FA verification to publish\.\.\.)(?:\n[ \t]*)*/g,
      "◒  Publishing packages◇  $1\n",
    )
    .replaceAll(
      /(?:◒ {2}Publishing packages(?:\n[ \t]*)*)*(?:[◇o] {2}(Successfully published:)|[▲x] {2}(Failed to publish))/g,
      (_match, success: string | undefined, failure: string | undefined) =>
        `◒  Publishing packages${success ? `◇  ${success}` : `▲  ${failure}`}`,
    )
    .replaceAll(
      /(?:◒ {2}Creating git tags(?:\n[ \t]*)*)*[◇o] {2}(Created git tags[:.])/g,
      "◒  Creating git tags◇  $1",
    )
    .replace(/(Created git tags\.)\n+$/, "$1\n")
    .replace(/(\n- [^\n]+)\n+$/, "$1\n")
    .replaceAll(new URL(registryUrl).origin, "[registry-url]")
    .replaceAll(/\/-\/auth\/cli\/[^\s"]+/g, "/-/auth/cli/[uuid]")
    .replaceAll(/\/-\/v1\/done\?authId=[^\s"]+/g, "/-/v1/done?authId=[uuid]");
}

async function fetchPackument(registry: TestRegistry, packageName: string) {
  const response = await fetch(
    new URL(encodeURIComponent(packageName), registry.url),
    {
      signal: AbortSignal.timeout(5_000),
    },
  );
  expect.soft(response.status).toBe(200);
  return response.json();
}

async function createPackedDir(cwd: string, packages: PackedPackage[]) {
  const packedDir = path.join(cwd, ".packed");
  const packagesDir = path.join(packedDir, "packages");
  await fs.mkdir(packagesDir, { recursive: true });
  const plan = [];

  for (const pkg of packages) {
    const manifest = {
      name: pkg.name,
      version: pkg.version,
      description: "",
      files: ["index.js"],
      license: "MIT",
      type: "module",
      changesetsPackedManifest: true,
    };
    const tarball = await packTarball([
      {
        path: "package/package.json",
        content: `${JSON.stringify(manifest, undefined, 2)}\n`,
      },
      { path: "package/index.js", content: `export default '${pkg.name}';\n` },
    ]);
    const filename = getPackageTarballFilename(pkg.name, pkg.version);
    await fs.writeFile(path.join(packagesDir, filename), tarball);
    plan.push({
      kind: "publish",
      name: pkg.name,
      version: pkg.version,
      access: "public",
      tag: "latest",
      tarball: {
        path: `packages/${filename}`,
        integrity: `sha256-${createHash("sha256").update(tarball).digest("base64")}`,
      },
    });
  }

  await fs.writeFile(
    path.join(packedDir, "publish-plan.json"),
    JSON.stringify({
      version: 1,
      plan: [plan],
    }),
  );
  return packedDir;
}

function createPmContext(
  registry: TestRegistry,
  pmBinPath: string,
  authToken: TestRegistryConfig["authToken"] = registry.pnprToken,
) {
  return {
    pmBinPath,
    registry: {
      authToken,
      host: registry.host,
      url: registry.url,
    },
  };
}

describe("Publish command e2e", { tags: ["slow"] }, () => {
  describe.each(pmCases)("$name", (pm) => {
    it("publishes a new version of a package", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("surfaces pre-publish errors", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(createPmContext(registry, pmBinPath), {
        ...createPkgAFixture(),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          description: "",
          files: ["index.js"],
          license: "MIT",
          scripts: {
            prepack:
              "node -e \"console.log(JSON.stringify({ lifecycle: 'output' })); console.error('prepack failed'); process.exit(1)\"",
          },
          type: "module",
        }),
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("publishes a first version of a package", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(await createTestRegistry());
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("handles lifecycle stdout while publishing", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(await createTestRegistry());
      const cwd = await pm.gitdir(createPmContext(registry, pmBinPath), {
        ...createPkgAFixture(),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          description: "",
          files: ["index.js"],
          license: "MIT",
          scripts: {
            prepack:
              "node -e \"console.log(JSON.stringify({ lifecycle: 'output' }))\"",
          },
          type: "module",
        }),
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("publishes a new pre version of an only-pre package without existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.0"],
              tags: { beta: "1.0.0-beta.0" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const initialPackument = await fetchPackument(registry, "pkg-a");
      expect.soft(initialPackument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.0",
        },
        name: "pkg-a",
      });
      expect.soft(initialPackument).not.toMatchObject({
        "dist-tags": {
          latest: expect.anything(),
        },
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(true);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.0": {
            name: "pkg-a",
            version: "1.0.0-beta.0",
          },
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
    });

    it("publishes a new pre version of an only-pre package with existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.0"],
              tags: {
                beta: "1.0.0-beta.0",
                latest: "1.0.0-beta.0",
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const initialPackument = await fetchPackument(registry, "pkg-a");
      expect.soft(initialPackument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.0",
          latest: "1.0.0-beta.0",
        },
        name: "pkg-a",
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(true);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.0",
          latest: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.0": {
            name: "pkg-a",
            version: "1.0.0-beta.0",
          },
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
    });

    it("skips already-published pre version of an only-pre package without existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.1"],
              tags: { beta: "1.0.0-beta.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const initialPackument = await fetchPackument(registry, "pkg-a");
      expect.soft(initialPackument).not.toMatchObject({
        "dist-tags": {
          latest: expect.anything(),
        },
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0-beta.1!");
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(false);
      expect
        .soft(
          registry.requests.filter(
            (request) =>
              request.method === "PUT" && request.pathname === "/pkg-a",
          ),
        )
        .toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        "dist-tags": {
          latest: expect.anything(),
        },
      });
    });

    it("skips already-published pre version of an only-pre package with existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.1"],
              tags: {
                beta: "1.0.0-beta.1",
                latest: "1.0.0-beta.1",
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0-beta.1!");
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(false);
      expect
        .soft(
          registry.requests.filter(
            (request) =>
              request.method === "PUT" && request.pathname === "/pkg-a",
          ),
        )
        .toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.1",
          latest: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
    });

    it.runIf(pm.name !== "yarn 4")(
      "publishes from a pack directory",
      async ({ signal }) => {
        await using stack = new AbortableAsyncDisposableStack(signal);
        const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
        const registry = stack.use(await createTestRegistry());
        const cwd = await pm.gitdir(
          createPmContext(registry, pmBinPath),
          createPkgAFixture(),
        );
        const packedDir = await createPackedDir(cwd, [
          { name: "pkg-a", version: "1.0.0" },
        ]);

        const result = await runCliCommand({
          command: "publish",
          args: ["--from-pack-dir", packedDir],
          cwd,
          pmBinPath,
          signal,
        });
        expect.soft(result.exitCode).toBe(0);

        const publishRequests = registry.requests.filter(
          (request) =>
            request.method === "PUT" && request.pathname === "/pkg-a",
        );
        expect.soft(publishRequests).toEqual([
          expect.objectContaining({
            authorization: `Bearer ${registry.pnprToken}`,
            otpCode: undefined,
            statusCode: 201,
          }),
        ]);

        await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(true);
        const packument = await fetchPackument(registry, "pkg-a");
        expect.soft(packument).toMatchObject({
          "dist-tags": {
            latest: "1.0.0",
          },
          name: "pkg-a",
          versions: {
            "1.0.0": {
              name: "pkg-a",
              version: "1.0.0",
              changesetsPackedManifest: true,
            },
          },
        });
      },
    );

    it("surfaces publish failures for bad credentials", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, BAD_CLIENT_AUTH_TOKEN),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${BAD_CLIENT_AUTH_TOKEN}`,
          statusCode: 401,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("surfaces publish failures when not logged in", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, null),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect
        .soft(
          publishRequests.map(({ authorization, statusCode }) => ({
            authorization,
            statusCode,
          })),
        )
        .toEqual(
          // Most package managers fail locally when no token is configured. pnpm 11
          // still sends the publish request and lets the registry reject it.
          pm.name === "pnpm 11"
            ? [{ authorization: undefined, statusCode: 401 }]
            : [],
        );

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("does not publish an already-published version", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0"],
              tags: { latest: "1.0.0" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0!");
      await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);
      expect
        .soft(
          registry.requests.filter(
            (request) =>
              request.method === "PUT" && request.pathname === "/pkg-a",
          ),
        )
        .toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("skips already-published version publish errors after our publish plan preflight", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      let packageSeeded = false;
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          async middleware({ pnpr, record, request }) {
            if (record.packageName !== "pkg-a") {
              return;
            }

            if (request.method === "GET" && !packageSeeded) {
              const response = await pnpr.fetch(request);
              await pnpr.seedPackage("pkg-a", {
                versions: ["1.0.0"],
                tags: { latest: "1.0.0" },
              });
              packageSeeded = true;
              return response;
            }

            if (request.method === "PUT") {
              // pnpr currently accepts publishing over an existing version here, while
              // npm rejects it. Keep this response synthetic to exercise npm's
              // already-published race semantics.
              return Response.json(
                {
                  error:
                    "You cannot publish over the previously published versions: 1.0.0.",
                  success: false,
                },
                { status: 403 },
              );
            }
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0!");
      await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests.map((request) => request.statusCode)).toEqual(
        // npm 11+ rejects an already-published version during its local
        // preflight. Other clients send the PUT and receive the registry's 403.
        pm.name !== "npm 11" && pm.name !== "npm 12" ? [403] : [],
      );
    });

    it("skips already-published version publish errors after possible package manager preflights", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          async middleware({ pnpr, record, request }) {
            if (request.method !== "PUT" || record.packageName !== "pkg-a") {
              return;
            }

            const body = record.bodyJson;
            const requestedVersions =
              body &&
              typeof body === "object" &&
              "versions" in body &&
              body.versions &&
              typeof body.versions === "object"
                ? Object.keys(body.versions)
                : [];

            if (!requestedVersions.includes("1.0.0")) {
              return pnpr.fetch(request);
            }

            await pnpr.seedPackage("pkg-a", {
              versions: ["1.0.0"],
              tags: { latest: "1.0.0" },
            });
            // pnpr currently accepts publishing over an existing version here, while
            // npm rejects it. Keep this response synthetic to exercise npm's
            // already-published race semantics.
            return Response.json(
              {
                error:
                  "You cannot publish over the previously published versions: 1.0.0.",
                success: false,
              },
              { status: 403 },
            );
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0!");
      await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          statusCode: 403,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it.runIf(pm.name !== "yarn 4")(
      "reads initial otp from env in non-tty mode",
      async ({ signal }) => {
        await using stack = new AbortableAsyncDisposableStack(signal);
        const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
        const registry = stack.use(
          await createTestRegistry({
            packages: {
              "pkg-a": {
                versions: ["0.0.1"],
                tags: { latest: "0.0.1" },
              },
            },
            auth: {
              packages: {
                "pkg-a": {
                  token: CLIENT_AUTH_TOKEN,
                  otp: { code: "654321" },
                },
              },
            },
          }),
        );
        const cwd = await pm.gitdir(
          createPmContext(registry, pmBinPath, CLIENT_AUTH_TOKEN),
          createPkgAFixture(),
        );

        const result = await runCliCommand({
          command: "publish",
          cwd,
          env: {
            [pm.name.startsWith("pnpm 11")
              ? "PNPM_CONFIG_OTP"
              : "NPM_CONFIG_OTP"]: "654321",
          },
          pmBinPath,
          signal,
        });
        expect.soft(result.exitCode).toBe(0);

        const publishRequests = registry.requests.filter(
          (request) =>
            request.method === "PUT" && request.pathname === "/pkg-a",
        );
        expect.soft(publishRequests).toEqual([
          expect.objectContaining({
            authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
            otpCode: "654321",
            statusCode: 201,
          }),
        ]);

        const packument = await fetchPackument(registry, "pkg-a");
        expect.soft(packument).toMatchObject({
          "dist-tags": {
            latest: "1.0.0",
          },
          name: "pkg-a",
          versions: {
            "0.0.1": {
              name: "pkg-a",
              version: "0.0.1",
            },
            "1.0.0": {
              name: "pkg-a",
              version: "1.0.0",
            },
          },
        });
      },
    );

    it("surfaces web-auth OTP publish failures in non-tty mode", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          auth: {
            packages: {
              "pkg-a": {
                token: CLIENT_AUTH_TOKEN,
                otp: { code: "654321", webAuth: true },
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, CLIENT_AUTH_TOKEN),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      // Yarn 4 retries with our fake otp code provided to it in the stdin in the non-tty mode
      expect.soft(publishRequests).toHaveLength(pm.name === "yarn 4" ? 2 : 1);
      expect.soft(publishRequests[0]).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          headers: expect.objectContaining({
            ...(pm.name !== "yarn 4" && {
              "npm-auth-type": "web",
              "npm-command": "publish",
            }),
          }),
          otpCode: undefined,
          statusCode: 401,
        }),
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("retries interactively after an OTP auth challenge", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          auth: {
            packages: {
              "pkg-a": {
                token: CLIENT_AUTH_TOKEN,
                otp: { code: "654321" },
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, CLIENT_AUTH_TOKEN),
        createPkgAFixture(),
      );

      let output = "";
      let otpWritten = false;
      const result = await runCliCommand({
        command: "publish",
        cwd,
        onData(chunk, write) {
          output += chunk;
          if (
            !otpWritten &&
            (output.includes("Enter OTP:") ||
              output.includes("One-time password:"))
          ) {
            otpWritten = true;
            write("654321\r");
          }
        },
        pmBinPath,
        signal,
        tty: true,
      });
      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      // We end up with 3 requests because the first non-tty attempt fails without OTP,
      // then the secon interactive attempt fails without OTP, prompts the user for the OTP and then sends the third (but second to its CLI invocation) request with the OTP.
      // Yarn 4 retries with our fake otp code provided to it in the stdin in the non-tty mode so it has one extra.
      expect.soft(publishRequests).toHaveLength(pm.name === "yarn 4" ? 4 : 3);
      expect.soft(publishRequests[0]).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: undefined,
          statusCode: 401,
        }),
      );
      expect.soft(publishRequests.at(-2)).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: undefined,
          statusCode: 401,
        }),
      );
      expect.soft(publishRequests.at(-1)).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: "654321",
          statusCode: 201,
        }),
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });
  });
});
