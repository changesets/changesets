import { error, log } from "@changesets/logger";
import { Config } from "@changesets/types";
import { getVersionableChangedPackages } from "../../utils/versionablePackages";

export default async function changed(
  cwd: string,
  {
    since,
    json,
  }: {
    since?: string;
    json?: boolean;
  },
  config: Config
): Promise<void> {
  const changedPackages = await getVersionableChangedPackages(config, {
    cwd,
    ref: since,
  });

  if (json) {
    const output = changedPackages.map((pkg) => ({
      name: pkg.packageJson.name,
      dir: pkg.dir,
    }));
    log(JSON.stringify(output, null, 2));
  } else {
    if (changedPackages.length === 0) {
      error("No changed packages found");
    } else {
      for (const pkg of changedPackages) {
        log(pkg.packageJson.name);
      }
    }
  }
}
