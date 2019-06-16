import getWorkspaces from "get-workspaces";

// Within changesets we always want to resolve yarn, bolt, and root,
// so this wrapper around get-workspaces saves us some typing
export default async function(opts: { cwd: string }) {
  let workspaces = await getWorkspaces({
    tools: ["yarn", "bolt", "root"],
    ...opts
  });
  if (workspaces === null) {
    return [];
  }
  return workspaces;
}
