import getWorkspaces from "get-workspaces";

export default function(opts: { cwd: string }) {
  return getWorkspaces({ tools: ["yarn", "bolt", "root"], ...opts });
}
