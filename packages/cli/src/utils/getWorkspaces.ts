import getWorkspaces from "get-workspaces";

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
