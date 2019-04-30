const outdent = require('outdent');
const parseChangesetCommit = require('../../changeset/parseChangesetCommit');

const simpleChangeset = {
  summary: 'This is a summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [],
  commit: 'dec4a66',
};

describe('parseChangesetCommit', () => {
  it('should be able to parse a commit message and return json', () => {
    const commitStr = outdent`
      CHANGESET: This is a summary

      Summary: Nothing in here matters for the parsing

      Release notes: path/to/release/notes.md

      Releases: package-a@minor, package-b@major

      Dependents: package-c@patch

      ---
      ${JSON.stringify(simpleChangeset)}
      ---
    `;
    const parsed = parseChangesetCommit(commitStr);
    expect(parsed).toEqual(simpleChangeset);
  });

  it('should not care about empty lines', () => {
    const commit = outdent`
      CHANGESET: This is a truncated summary of the change....
      Summary: This is the untruncated summary

      Releases: package-a

      Dependents: package-a, package-b, package-c

      ---
      {"summary": "This is a super cool version","releaseNotes": "doc.md","releases": [{"name": "package-a","type": "major"}],"dependents": [{"name": "package-b", "type": "minor", "dependencies": ["package-a"]},{"name": "package-c", "type": "patch", "dependencies": ["package-b"]},{"name": "package-a", "type": "patch", "dependencies": ["package-c"]}]}
      ---
    `;
    const changeset = parseChangesetCommit(commit);
    expect(changeset).toEqual({
      summary: 'This is a super cool version',
      releaseNotes: 'doc.md',
      releases: [{ name: 'package-a', type: 'major' }],
      dependents: [
        { name: 'package-b', type: 'minor', dependencies: ['package-a'] },
        { name: 'package-c', type: 'patch', dependencies: ['package-b'] },
        { name: 'package-a', type: 'patch', dependencies: ['package-c'] },
      ],
    });
  });
});
