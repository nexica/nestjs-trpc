module.exports = {
    verifyConditions: () => {},
    analyzeCommits: () => {},

    async prepare(pluginConfig, { branch, nextRelease }) {
        // only run on rc or main
        if (!['rc', 'main'].includes(branch.name)) return

        const fs = require('fs')
        const path = 'CHANGELOG.md'
        const lines = fs.readFileSync(path, 'utf8').split('\n')

        // Find all release headings and their positions
        const releasePattern = /^## \[([\d\w.-]+)\]/
        const releases = []

        lines.forEach((line, index) => {
            const match = line.match(releasePattern)
            if (match) {
                const version = match[1]
                let type = 'stable' // default for versions like "1.0.0"

                if (version.includes('-dev.')) {
                    type = 'dev'
                } else if (version.includes('-rc.')) {
                    type = 'rc'
                }

                releases.push({ version, type, lineIndex: index })
            }
        })

        if (releases.length === 0) return

        // Determine which release types to remove based on branch
        let typesToRemove = []
        if (branch.name === 'rc') {
            // On rc branch: remove dev releases between current and last rc/stable
            typesToRemove = ['dev']
        } else if (branch.name === 'main') {
            // On main branch: remove rc releases between current and last stable
            typesToRemove = ['rc']
        }

        if (typesToRemove.length === 0) return

        // Find the range to clean up
        const currentRelease = releases[0] // most recent release
        let lastStableIndex = -1

        // Find the last rc or stable release (depending on branch)
        for (let i = 1; i < releases.length; i++) {
            const release = releases[i]
            if (branch.name === 'rc' && (release.type === 'rc' || release.type === 'stable')) {
                lastStableIndex = i
                break
            } else if (branch.name === 'main' && release.type === 'stable') {
                lastStableIndex = i
                break
            }
        }

        // If no stable release found, clean up to the end
        const releasesToCheck = lastStableIndex === -1 ? releases.slice(1) : releases.slice(1, lastStableIndex)

        // Find releases to remove
        const releasesToRemove = releasesToCheck.filter((release) => typesToRemove.includes(release.type))

        if (releasesToRemove.length === 0) return

        // Remove the sections for unwanted releases
        let newLines = [...lines]

        // Process releases in reverse order to maintain correct line indices
        for (let i = releasesToRemove.length - 1; i >= 0; i--) {
            const releaseToRemove = releasesToRemove[i]
            const startIndex = releaseToRemove.lineIndex

            // Find the end of this release section (start of next release or end of file)
            let endIndex = newLines.length
            for (let j = startIndex + 1; j < newLines.length; j++) {
                if (newLines[j].match(releasePattern)) {
                    endIndex = j
                    break
                }
            }

            // Remove the release section
            newLines.splice(startIndex, endIndex - startIndex)
        }

        fs.writeFileSync(path, newLines.join('\n'))
    },
}
