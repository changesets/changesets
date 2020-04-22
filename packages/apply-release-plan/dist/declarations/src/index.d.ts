import { ReleasePlan, Config } from "@changesets/types";
import { Packages, Package } from "@manypkg/get-packages";
export default function applyReleasePlan(releasePlan: ReleasePlan, packages: Packages, config?: Config): Promise<any[]>;
/**
 * Retrieves the releases from `releasePlan` with their generated markdown changelog entries
 */
export declare function getReleasesWithChangelogs(releasePlan: ReleasePlan, packages: Package[], changelogConfig: false | readonly [string, any], cwd: string): Promise<[unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]>;
