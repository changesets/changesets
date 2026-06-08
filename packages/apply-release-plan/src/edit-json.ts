import { parse, type CstValueNode } from "json-cst";

export interface EditJsonOperation {
  keys: string[];
  value: unknown;
}

/**
 * A simple JSON editing utility that preserves formatting. They specified operation keys
 * must exist in the JSON for this implementation.
 */
export function editJson(
  json: string,
  operations: EditJsonOperation[],
): string {
  const parsed = parse(json);

  const nodesToUpdate = operations.map((op) => {
    const valueNode = getValueNode(parsed.root, op.keys);
    if (!valueNode) {
      throw new Error(`Key path "${op.keys.join(".")}" not found in JSON`);
    }
    return { node: valueNode, value: op.value };
  });

  // Update nodes in reverse order to avoid altering offsets of subsequent runs
  nodesToUpdate.sort((a, b) => b.node.range.start - a.node.range.start);

  for (const update of nodesToUpdate) {
    const { start, end } = update.node.range;
    json =
      json.slice(0, start) + JSON.stringify(update.value) + json.slice(end);
  }

  return json;
}

function getValueNode(root: CstValueNode, keys: string[]): CstValueNode | null {
  let node = root;
  for (const key of keys) {
    if (node.kind !== "object") return null;
    const property = node.children.find((child) => child.key === key);
    if (!property) return null;
    node = property.valueNode;
  }
  return node;
}
