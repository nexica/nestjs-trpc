#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Get project root
const rootDir = path.resolve(__dirname, '..')

// Files and directories to keep in root
const keepList = ['.git', 'dist', 'package.json', 'README.md', 'CHANGELOG.md', 'node_modules', '.']

console.log('Cleaning project for release...')

try {
    // Create a minimal package.json
    console.log('Creating minimal package.json...')
    const packageJsonPath = path.join(rootDir, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    // Fields to keep in the minimal package.json
    const minimalPackageJson = {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        main: packageJson.main,
        bin: packageJson.bin,
        types: packageJson.types,
        keywords: packageJson.keywords,
        author: packageJson.author,
        license: packageJson.license,
        publishConfig: packageJson.publishConfig,
        peerDependencies: packageJson.peerDependencies,
        dependencies: packageJson.dependencies,
    }

    // Backup original package.json before overwriting
    const backupPath = path.join(rootDir, 'package.json.backup')
    fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2))

    // Write the minimal package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(minimalPackageJson, null, 2))
    console.log('Created minimal package.json')

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
