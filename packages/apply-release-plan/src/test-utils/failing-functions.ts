// plugin, must have a default export
/* eslint-disable import-lite/no-default-export */

import type { ChangelogFunctions } from "@changesets/types";

export default {
  getReleaseLine: () => {
    throw new Error("no chance");
  },
  getDependencyReleaseLine: () => {
    throw new Error("no chance");
  },
} satisfies ChangelogFunctions;
