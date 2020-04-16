import { Config } from "@changesets/types";
import getChangelogEntries, {
  addCommitToChangesets,
  resolveChangelogFunctions
} from "@changesets/generate-changelogs";
import { getPackages } from "@manypkg/get-packages";
import getReleasePlan from "@changesets/get-release-plan";
import { read } from "@changesets/config";

export default async function getReleaseNotes(
  cwd: string,
  passedConfig?: Config
) {
  let packages = await getPackages(cwd);

  const readConfig = await read(cwd, packages);
  const config: Config = passedConfig
    ? { ...readConfig, ...passedConfig }
    : readConfig;

  let { changesets, releases } = await getReleasePlan(cwd, undefined, config);

  let changelogConfig = config.changelog;

  if (!changelogConfig) {
    throw new Error(
      "We can't generate release notes right now, as generating changelogs is switched off!"
    );
  }

  let changesetWCommit = await addCommitToChangesets(
    changesets,
    packages.root.dir
  );

  let changelogFuncs = await resolveChangelogFunctions(
    changelogConfig[0],
    packages.root.dir
  );

  console.log(releases);
  console.log(changesetWCommit);
  console.log(packages);

  let changelogEntries = await getChangelogEntries(
    releases,
    changesetWCommit,
    packages,
    changelogFuncs,
    changelogConfig[1]
  );

  return changelogEntries;

  // await Promise.all(
  //     changedWorkspaces.map(async workspace => {
  //       let changelogContents = await fs.readFile(
  //         path.join(workspace.dir, "CHANGELOG.md"),
  //         "utf8"
  //       );

  //       let entry = getChangelogEntry(
  //         changelogContents,
  //         workspace.config.version
  //       );
  //       return {
  //         highestLevel: entry.highestLevel,
  //         private: !!workspace.config.private,
  //         content:
  //           `## ${workspace.name}@${workspace.config.version}\n\n` +
  //           entry.content
  //       };
  //     })
  //   )
  // )
  //   .filter(x => x)
  //   .sort(sortTheThings)
  //   .map(x => x.content)
  //   .join("\n ")
}
