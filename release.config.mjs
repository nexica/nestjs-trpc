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
                releaseRules: [{ type: 'chore', scope: 'deps', release: 'patch' }],
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
        '@semantic-release/npm',
        [
            '@semantic-release/git',
            {
                assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
                message: 'chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
    ],
}
