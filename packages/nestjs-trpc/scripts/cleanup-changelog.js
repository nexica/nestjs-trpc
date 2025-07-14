module.exports = {
    verifyConditions: () => {},
    analyzeCommits: () => {},

    async prepare(pluginConfig, { branch, nextRelease }) {
        // only run on rc or main
        if (!['rc', 'main'].includes(branch.name)) return

        const fs = require('fs')
        const path = 'CHANGELOG.md'
        const lines = fs.readFileSync(path, 'utf8').split('\n')

        // nextRelease.version already includes "-rc.X" on rc branch
        const heading = `## [${nextRelease.version}]`
        const idx = lines.findIndex((l) => l.startsWith(heading))
        if (idx === -1) return

        // preserve top-of-file header (e.g. "# Changelog" + blank line)
        const header = lines.slice(0, 2)
        const releaseBlock = lines.slice(idx)

        fs.writeFileSync(path, [...header, '', ...releaseBlock].join('\n'))
    },
}
