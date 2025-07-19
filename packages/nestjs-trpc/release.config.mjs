/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
    branches: [{ name: 'dev', channel: 'dev', prerelease: true }, { name: 'rc', channel: 'next', prerelease: 'rc' }, 'main'],
    tagFormat: '${version}',
    plugins: [
        ['@semantic-release/commit-analyzer', {}],
        [
            '@semantic-release/release-notes-generator',
            {
                preset: 'angular',
                writerOpts: {
                    headerPartial: '',
                },
                releaseRules: [
                    { type: 'chore', scope: 'deps', release: 'patch' },
                    { type: 'chore', scope: 'readme', release: 'patch' },
                    { type: 'refactor', release: 'patch' },
                ],
            },
        ],
        [
            '@semantic-release/changelog',
            {
                changelogFile: 'CHANGELOG.md',
            },
        ],
        './scripts/cleanup-changelog.js',
        [
            '@semantic-release/exec',
            {
                prepareCmd: 'cp ../../README.md ./README.md',
            },
        ],
        '@semantic-release/npm',
        ['@semantic-release/github', {}],
        [
            '@semantic-release/git',
            {
                assets: ['CHANGELOG.md', 'package.json', 'package-lock.json', 'README.md'],
                message: 'chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
    ],
}
