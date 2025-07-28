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
                analyzeCommits: async (pluginConfig, context) => {
                    const { commits, logger } = context

                    const relevantCommits = []

                    for (const commit of commits) {
                        let hasRelevantFiles = false

                        if (commit.files && commit.files.length > 0) {
                            hasRelevantFiles = commit.files.some((file) => {
                                return file.startsWith('packages/nestjs-trpc/')
                            })
                        } else {
                            logger.log('No file info available, including commit to be safe')
                            hasRelevantFiles = true
                        }

                        if (hasRelevantFiles) {
                            relevantCommits.push(commit)
                        }
                    }

                    logger.log(`Filtered ${commits.length} commits down to ${relevantCommits.length} relevant commits for nestjs-trpc package`)

                    if (relevantCommits.length === 0) {
                        logger.log('No commits affect nestjs-trpc package files, skipping release')
                        return null
                    }

                    const { default: defaultAnalyzer } = await import('@semantic-release/commit-analyzer')
                    return defaultAnalyzer.analyzeCommits({ preset: 'angular' }, { ...context, commits: relevantCommits })
                },
            },
        ],
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
