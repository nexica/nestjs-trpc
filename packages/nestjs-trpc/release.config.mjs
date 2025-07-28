/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
    extends: 'semantic-release-monorepo',
    branches: [{ name: 'dev', channel: 'dev', prerelease: true }, { name: 'rc', channel: 'next', prerelease: 'rc' }, 'main'],
    tagFormat: '${version}',
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/exec',
            {
                prepareCmd: 'cp ../../README.md ./README.md',
            },
        ],
        '@semantic-release/npm',
        ['@semantic-release/github', {}],
    ],
}
