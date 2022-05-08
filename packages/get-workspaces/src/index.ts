import { getPackages, Package, Packages } from "@manypkg/get-packages";

const getWorkspaces = getPackages;

export { getWorkspaces, Package, Packages };

// throw new Error(
//   "get-workspaces has been replaced by @manypkg/get-packages, please use that package instead."
// );
