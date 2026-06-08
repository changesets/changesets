import {
  applyEdits,
  parseTree,
  printParseErrorCode,
  type EditResult,
  type Node,
  type ParseError,
} from "jsonc-parser";

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
  const errors: ParseError[] = [];
  const parsed = parseTree(json, errors, {
    allowEmptyContent: false,
    allowTrailingComma: false,
    disallowComments: true,
  });

  if (!parsed) {
    throw new Error("Failed to parse JSON");
  }
  if (errors.length > 0) {
    // Since the first error could cause subsequent errors, we only report the first one
    const error = errors[0];
    throw new Error(
      `Failed to parse JSON at offset ${error.offset}: ${printParseErrorCode(error.error)}`,
    );
  }

  const edits: EditResult = operations.map((op) => {
    const valueNode = getValueNode(parsed, op.keys);
    if (!valueNode) {
      throw new Error(`Key path "${op.keys.join(".")}" not found in JSON`);
    }
    return {
      content: JSON.stringify(op.value),
      offset: valueNode.offset,
      length: valueNode.length,
    };
  });

  return applyEdits(json, edits);
}

function getValueNode(root: Node, keys: string[]): Node | null {
  let node = root;
  for (const key of keys) {
    if (node.type !== "object") return null;
    const property = node.children?.find(
      (child) =>
        child.type === "property" &&
        child.children?.length === 2 &&
        child.children[0].value === key,
    );
    if (!property) return null;
    // We've checked above that `children[1]` exists
    node = property.children![1];
  }
  return node;
}
