import { ComprehensiveRelease, PackageJSON } from "@changesets/types";
export default function versionPackage(release: ComprehensiveRelease & {
    changelog: string | null;
    packageJson: PackageJSON;
    dir: string;
}, versionsToUpdate: Array<{
    name: string;
    version: string;
}>): any;
