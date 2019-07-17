import { Linked, ComprehensiveRelease } from "@changesets/types";

function applyLinks(
  releases: ComprehensiveRelease[],
  linked?: Linked
): boolean {
  let updated = false;
  if (!linked) return updated;

  for (let linkedSet in linked) {
  }

  return updated;
}

export default applyLinks;
