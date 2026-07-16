export function* streamNdjson(output: string): Generator<unknown> {
  let lineStart = 0;
  while (lineStart <= output.length) {
    let lineEnd = output.indexOf("\n", lineStart);
    if (lineEnd === -1) {
      lineEnd = output.length;
    }

    const line = output.slice(lineStart, lineEnd);
    lineStart = lineEnd + 1;

    if (/^\s*$/.test(line)) {
      continue;
    }

    try {
      yield JSON.parse(line);
    } catch {
      continue;
    }
  }
}
