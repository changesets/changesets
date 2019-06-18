import { defaultConfig } from "../../utils/constants";
import resolveConfig from "../../utils/resolveConfig";
import getWorkspaces from "../../utils/getWorkspaces";
import getChangesetBase from "../../utils/getChangesetBase";
import { removeFolders, removeEmptyFolders } from "../../utils/removeFolders";

export default async function bump(opts: {}) {
  const cwd = opts.cwd || process.cwd();

  let fullUserConfig = await resolveConfig(cwd);
  let userConfig =
    fullUserConfig && fullUserConfig.versionOptions
      ? fullUserConfig.versionOptions
      : {};

  const config: {} = {
    ...defaultConfig.versionOptions,
    ...userConfig,
    ...opts
  };

  const allPackages = await getWorkspaces({ cwd });
  const changesetBase = await getChangesetBase(cwd);
  removeEmptyFolders(changesetBase);

  // read new changesets in

  // read legacy changesets in
}
