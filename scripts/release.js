#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')

// Get project root
const rootDir = path.resolve(__dirname, '..')

// Files and directories to keep in root
const keepList = ['.git', 'dist', 'package.json', 'README.md', 'CHANGELOG.md', 'node_modules', '.']

console.log('Cleaning project for release...')

try {
    // Build the find command using the keepList array
    const excludeArgs = keepList.map((item) => `-not -name ${item}`).join(' ')
    const command = `find . -maxdepth 1 ${excludeArgs} -exec rm -rf {} \\;`

    // Execute the command
    execSync(command, {
        cwd: rootDir,
        stdio: 'inherit',
    })

    console.log('Clean completed successfully!')
    console.log(`Kept: ${keepList.filter((item) => item !== '.' && item !== 'scripts').join(', ')}, and scripts/release.js`)
    console.log('Package.json has been minimized for release')
} catch (error) {
    console.error('Error cleaning project:', error)
    process.exit(1)
}
