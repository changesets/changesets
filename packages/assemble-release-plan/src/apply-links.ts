import { Linked, ComprehensiveRelease } from "@changesets/types";

function applyLinks(
  releases: ComprehensiveRelease[],
  linked?: Linked
): boolean {
  let updated = false;
  if (!linked) return updated;

  for (let linkedSet in linked) {
    console.log("we should do something with", linkedSet);
  }

  return updated;
}

export default applyLinks;
