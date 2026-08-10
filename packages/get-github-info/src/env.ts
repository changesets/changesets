import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";

async function readEnvFile() {
  const envFile = path.resolve(process.cwd(), ".env");
  let content: string | undefined;
  try {
    content = await fs.readFile(envFile, "utf-8");
  } catch {
    return {};
  }
  return util.parseEnv(content);
}

let cachedEnv: ReturnType<typeof readEnvFile> | undefined;
function readEnvFileCached() {
  cachedEnv ??= readEnvFile();
  return cachedEnv;
}

export async function readEnv() {
  const GITHUB_GRAPHQL_URL =
    process.env.GITHUB_GRAPHQL_URL ||
    (await readEnvFileCached()).GITHUB_GRAPHQL_URL ||
    "https://api.github.com/graphql";
  const GITHUB_SERVER_URL =
    process.env.GITHUB_SERVER_URL ||
    (await readEnvFileCached()).GITHUB_SERVER_URL ||
    "https://github.com";
  const GITHUB_TOKEN =
    process.env.GITHUB_TOKEN || (await readEnvFileCached()).GITHUB_TOKEN;
  return { GITHUB_GRAPHQL_URL, GITHUB_SERVER_URL, GITHUB_TOKEN };
}
