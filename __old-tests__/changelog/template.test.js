const outdent = require('outdent');
const generateMarkdownTemplate = require('../../changelog/template');
const { versionOptions } = require('../../initialize/initial/config');

describe('template', () => {
  it('should generate template from a simple release object', async () => {
    const input = {
      releases: [
        {
          name: '@atlaskit/badge',
          version: '1.0.0',
          commits: ['496287c'],
        },
      ],
      changesets: [
        {
          summary: 'We fix few bugs in badge.',
          commit: '496287c',
          releases: [
            {
              name: '@atlaskit/badge',
              type: 'patch',
            },
          ],
          dependents: [],
        },
      ],
    };

    const output = await generateMarkdownTemplate(
      input.releases[0],
      input,
      versionOptions,
    );
    const expectedOutput = outdent`
      ## 1.0.0
      - [patch] 496287c:

        We fix few bugs in badge.`;
    expect(output).toBe(expectedOutput);
  });

  it('should create message for release of dependencies', async () => {
    const input = {
      releases: [
        {
          name: '@atlaskit/badge',
          version: '1.0.0',
          commits: ['496287c'],
        },
        {
          name: '@atlaskit/code',
          version: '1.0.1',
          commits: ['496287c'],
        },
      ],
      changesets: [
        {
          summary: 'We fix few bugs in badge.',
          releaseNotes: 'release.md',
          commit: '496287c',
          releases: [
            {
              name: '@atlaskit/badge',
              type: 'patch',
            },
          ],
          dependents: [
            {
              name: '@atlaskit/code',
              type: 'minor',
              dependencies: ['@atlaskit/badge'],
            },
          ],
        },
      ],
    };

    const output = await generateMarkdownTemplate(
      input.releases[1],
      input,
      versionOptions,
    );
    const expectedOutput2 = outdent`
      ## 1.0.1
      - Updated dependencies [496287c]:
        - @atlaskit/badge@1.0.0`;
    expect(output).toBe(expectedOutput2);
  });
  it('should work with custom getReleaseLine', async () => {
    const input = {
      releases: [
        {
          name: '@atlaskit/badge',
          version: '1.0.0',
          commits: ['496287c'],
        },
      ],
      changesets: [
        {
          summary: 'We fix few bugs in badge.',
          commit: '496287c',
          releases: [
            {
              name: '@atlaskit/badge',
              type: 'patch',
            },
          ],
          dependents: [],
        },
      ],
    };

    const getReleaseLine = async () => "look at me I'm the DCI";

    const output = await generateMarkdownTemplate(input.releases[0], input, {
      ...versionOptions,
      getReleaseLine,
    });
    const expectedOutput = outdent`
      ## 1.0.0
      look at me I'm the DCI`;
    expect(output).toBe(expectedOutput);
  });
  it('should work with custom getDependencyReleaseLine', async () => {
    const input = {
      releases: [
        {
          name: '@atlaskit/badge',
          version: '1.0.0',
          commits: ['496287c'],
        },
        {
          name: '@atlaskit/code',
          version: '1.0.1',
          commits: ['496287c'],
        },
      ],
      changesets: [
        {
          summary: 'We fix few bugs in badge.',
          releaseNotes: 'release.md',
          commit: '496287c',
          releases: [
            {
              name: '@atlaskit/badge',
              type: 'patch',
            },
          ],
          dependents: [
            {
              name: '@atlaskit/code',
              type: 'minor',
              dependencies: ['@atlaskit/badge'],
            },
          ],
        },
      ],
    };

    const getDependencyReleaseLine = async () => "look at me I'm R&D";

    const output = await generateMarkdownTemplate(input.releases[1], input, {
      ...versionOptions,
      getDependencyReleaseLine,
    });
    const expectedOutput2 = outdent`
      ## 1.0.1
      look at me I'm R&D
      `;
    expect(output).toBe(expectedOutput2);
  });
});
