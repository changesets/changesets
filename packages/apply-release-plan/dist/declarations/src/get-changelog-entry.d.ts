import { ChangelogFunctions, NewChangesetWithCommit } from "@changesets/types";
import { ModCompWithPackage } from "@changesets/types";
export default function generateMarkdown(release: ModCompWithPackage, releases: ModCompWithPackage[], changesets: NewChangesetWithCommit[], changelogFuncs: ChangelogFunctions, changelogOpts: any): Promise<string>;
