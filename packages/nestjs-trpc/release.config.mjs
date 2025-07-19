/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
    branches: [{ name: 'dev', channel: 'dev', prerelease: true }, { name: 'rc', channel: 'next', prerelease: 'rc' }, 'main'],
    tagFormat: '${version}',
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                preset: 'angular',
                releaseRules: [
                    { type: 'chore', scope: 'deps', release: 'patch' },
                    { type: 'chore', scope: 'readme', release: 'patch' },
                    { type: 'refactor', release: 'patch' },
                ],
            },
        ],
        '@semantic-release/release-notes-generator',
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
        [
            '@semantic-release/github',
            {
                // assets: [{ path: 'dist/*.tgz', label: 'npm package' }],
                // releaseTitle: 'v${nextRelease.version}',
            },
        ],
        [
            '@semantic-release/git',
            {
                assets: ['CHANGELOG.md', 'package.json', 'package-lock.json', 'README.md'],
                message: 'chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
    ],
}
