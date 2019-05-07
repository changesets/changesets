import getWorkspaces from "get-workspaces";

export default function(opts) {
  return getWorkspaces({ tools: ["yarn", "bolt", "root"], ...opts });
}
