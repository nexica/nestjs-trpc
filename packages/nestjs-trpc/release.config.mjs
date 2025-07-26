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
                ignoreCommits: [
                    {
                        // Ignore other packages
                        path: ['packages/nestjs-trpc-docs/**', 'packages/config/**'],
                    },
                    {
                        // Ignore root files
                        path: [
                            '.commitlintrc.json',
                            '.gitignore',
                            '.prettierignore',
                            '.prettierrc',
                            'LICENSE',
                            'package.json',
                            'pnpm-lock.yaml',
                            'pnpm-workspace.yaml',
                            'README.md',
                            'renovate.json',
                            'turbo.json',
                        ],
                    },
                    // Ignore root directories
                    {
                        path: ['.github/**', '.husky/**'],
                    },
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
