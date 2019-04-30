function parseChangesetCommit(commitMsg) {
  const lines = commitMsg.split('\n');
  let curLine;
  let jsonStr = '';

  // Throw away all the lines until we find the separator token
  do {
    curLine = lines.shift();
  } while (curLine !== '---' && curLine !== undefined);

  // If curLine is undefined, we didnt find our separator and this message is
  // not a changeset
  if (curLine === undefined) {
    return undefined;
  }

  curLine = lines.shift(); // Thow away the separator line

  // Get the json parts
  while (curLine !== '---' && curLine !== undefined) {
    jsonStr += curLine;
    curLine = lines.shift();
  }

  // If curLine is undefined, we didn't find the closing separator and this
  // is not a changeset
  if (curLine === undefined) {
    return undefined;
  }

  // due to some badly structured JSON in some old releases (trailing commas) we have to do this
  try {
    JSON.parse(jsonStr);
  } catch (e) {
    return undefined;
  }
  return JSON.parse(jsonStr);
}

module.exports = parseChangesetCommit;
