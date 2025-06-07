import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import { Project, SourceFile, ts } from 'ts-morph'

export class FileScanner {
    public static findFiles(directory: string, pattern: string): string[] {
        return glob.sync(pattern, { cwd: directory, absolute: true })
    }

    public static findTypeScriptFiles(directory: string): string[] {
        return this.findFiles(directory, '**/*.{ts,tsx}')
    }

    public static findTsConfigFile(directory: string): string | null {
        let currentDir = directory

        while (currentDir !== path.parse(currentDir).root) {
            const tsConfigPath = path.join(currentDir, 'tsconfig.json')

            if (fs.existsSync(tsConfigPath)) {
                return tsConfigPath
            }

            currentDir = path.dirname(currentDir)
        }

        return null
    }

    public static getCallerFilePath(): string {
        const originalStackPrepareStackTrace = Error.prepareStackTrace?.bind(Error)

        Error.prepareStackTrace = (_, stack) => stack
        const stack = new Error().stack as unknown as NodeJS.CallSite[]
        Error.prepareStackTrace = originalStackPrepareStackTrace

        const callerFile = stack[2]?.getFileName() || ''

        return callerFile
    }

    static findProjectRoot(startDir: string = process.cwd()): string {
        let dir = startDir
        const maxIterations = 10
        let iterations = 0

        while (dir !== path.parse(dir).root && iterations < maxIterations) {
            if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'tsconfig.json'))) {
                return dir
            }

            const parentDir = path.dirname(dir)
            if (parentDir === dir) {
                break
            }
            dir = parentDir
            iterations++
        }

        console.warn(`Could not find project root, using ${startDir} as fallback`)
        return startDir
    }

    static getTsEquivalentPath(filePath: string): string {
        return filePath.replace('\\dist\\', '\\src\\').replace('.js', '.ts')
    }

    static getInputAndOutputNamesFromDecorator(filePath: string, methodName: string): { input: string | undefined; output: string | undefined } {
        const tsPath = this.getTsEquivalentPath(filePath)

        if (!fs.existsSync(tsPath)) {
            return { input: undefined, output: undefined }
        }

        const project = new Project({
            compilerOptions: {
                target: ts.ScriptTarget.ES2019,
                module: ts.ModuleKind.CommonJS,
                emitDecoratorMetadata: true,
                experimentalDecorators: true,
            },
        })

        const sourceFile = project.addSourceFileAtPath(tsPath)

        const classes = sourceFile.getClasses()

        for (const classDeclaration of classes) {
            const method = classDeclaration.getMethod(methodName)

            if (!method) continue

            let queryDecorator = method.getDecorator('Query')
            if (!queryDecorator) queryDecorator = method.getDecorator('Mutation')

            if (!queryDecorator) continue

            const args = queryDecorator.getArguments()

            if (args.length === 0) continue

            const objLiteral = args[0]

            if (!objLiteral || !objLiteral.asKind(ts.SyntaxKind.ObjectLiteralExpression)) continue

            const properties = objLiteral.asKind(ts.SyntaxKind.ObjectLiteralExpression)?.getProperties()

            if (!properties) continue

            let inputName: string | undefined
            let outputName: string | undefined

            for (const prop of properties) {
                const propName = prop.getChildrenOfKind(ts.SyntaxKind.Identifier)[0]?.getText()

                if (propName === 'input') {
                    inputName = prop.getChildrenOfKind(ts.SyntaxKind.Identifier)[1]?.getText()
                } else if (propName === 'output') {
                    const initializer = prop.getLastChild()
                    outputName = initializer?.getText()
                }
            }

            return { input: inputName, output: outputName }
        }

        return { input: undefined, output: undefined }
    }

    public static resolvePathWithAliases(
        filePath: string,
        pathAliases: Record<string, string[]>,
        tsConfigDir: string,
        moduleCallerFilePath?: string
    ): string | null {
        if (path.isAbsolute(filePath) || filePath.startsWith('./') || filePath.startsWith('../')) {
            const resolvedPath = path.resolve(tsConfigDir, filePath)
            return resolvedPath
        }

        if (filePath.startsWith('@/')) {
            for (const [alias, targets] of Object.entries(pathAliases)) {
                if ((alias === '@/*' || alias === '@*') && targets.length > 0) {
                    const target = targets[0].replace('*', '')
                    const modulePath = filePath.replace('@/', '')
                    const resolvedPath = path.resolve(tsConfigDir, target, modulePath)

                    if (fs.existsSync(resolvedPath)) {
                        return resolvedPath
                    }
                }
            }

            if (moduleCallerFilePath) {
                const commonSourceFolders = [
                    moduleCallerFilePath,
                    path.join(moduleCallerFilePath, 'src'),
                    path.join(moduleCallerFilePath, 'app'),
                    path.join(moduleCallerFilePath, 'lib'),
                ]

                for (const srcFolder of commonSourceFolders) {
                    if (fs.existsSync(srcFolder)) {
                        const modulePath = filePath.replace('@/', '')
                        const resolvedPath = path.resolve(srcFolder, modulePath)

                        if (fs.existsSync(resolvedPath)) {
                            return resolvedPath
                        }
                    }
                }
            }
        }

        for (const [alias, targets] of Object.entries(pathAliases)) {
            const aliasPattern = alias.replace(/\*/g, '(.+)')
            const aliasRegex = new RegExp(`^${aliasPattern}$`)

            if (aliasRegex.test(filePath)) {
                if (targets.length > 0) {
                    const target = targets[0]

                    const processed = filePath.replace(aliasRegex, (_, capture: string) => {
                        return target.replace(/\*/g, capture)
                    })

                    const resolvedPath = path.resolve(tsConfigDir, processed)
                    return resolvedPath
                }
            }
        }

        if (!filePath.includes('/') && !filePath.includes('\\')) {
            try {
                const resolvedPath = require.resolve(filePath, { paths: [process.cwd(), tsConfigDir] })
                return resolvedPath
            } catch (e) {
                console.warn(`Could not resolve module: ${filePath}`, 'TRPC Generator')
            }
        }

        if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
            const projectRootPath = path.resolve(process.cwd(), filePath)
            if (fs.existsSync(projectRootPath)) {
                return projectRootPath
            }

            const tsConfigRelativePath = path.resolve(tsConfigDir, filePath)
            if (fs.existsSync(tsConfigRelativePath)) {
                return tsConfigRelativePath
            }

            const srcPath = path.resolve(process.cwd(), 'src', filePath)
            if (fs.existsSync(srcPath)) {
                return srcPath
            }
        }

        console.warn(`Could not resolve path with aliases, returning as is: ${filePath}`, 'TRPC Generator')
        return filePath
    }

    public static async injectFilesContent(filePaths: Array<string>, sourceFile: SourceFile, moduleCallerFilePath: string): Promise<void> {
        try {
            const tsConfigFilePath = FileScanner.findTsConfigFile(moduleCallerFilePath)

            if (tsConfigFilePath) {
                const tsConfigContent = fs.readFileSync(tsConfigFilePath, 'utf8')
                try {
                    const tsConfigObj = JSON.parse(tsConfigContent) as { compilerOptions?: { paths?: Record<string, string[]> } }
                    const pathAliases = tsConfigObj.compilerOptions?.paths || {}
                    const tsConfigDir = path.dirname(tsConfigFilePath)

                    // Expand any glob patterns in filePaths
                    const expandedFilePaths: string[] = []

                    for (const filePath of filePaths) {
                        // Handle path aliases first, especially @/ prefix
                        let resolvedBasePath = moduleCallerFilePath
                        let effectivePattern = filePath

                        // Special handling for @/ prefix in glob patterns
                        if (filePath.startsWith('@/')) {
                            // Try to resolve the base path for @/ alias from tsconfig paths
                            let aliasBaseResolved = false

                            for (const [alias, targets] of Object.entries(pathAliases)) {
                                if ((alias === '@/*' || alias === '@*') && targets.length > 0) {
                                    const target = targets[0].replace('*', '')
                                    // Remove the @/ prefix for the pattern
                                    effectivePattern = filePath.replace('@/', '')
                                    resolvedBasePath = path.resolve(tsConfigDir, target)
                                    aliasBaseResolved = true
                                    break
                                }
                            }

                            // If @/ wasn't in tsconfig paths, try common source directories
                            if (!aliasBaseResolved) {
                                const commonSourceFolders = [
                                    moduleCallerFilePath,
                                    path.join(path.dirname(moduleCallerFilePath), 'src'),
                                    path.join(path.dirname(moduleCallerFilePath), 'app'),
                                    path.join(path.dirname(moduleCallerFilePath), 'lib'),
                                    process.cwd(),
                                    path.join(process.cwd(), 'src'),
                                    path.join(process.cwd(), 'app'),
                                ]

                                effectivePattern = filePath.replace('@/', '')

                                // Find the first directory that exists and contains files matching the pattern
                                for (const folder of commonSourceFolders) {
                                    if (fs.existsSync(folder)) {
                                        try {
                                            // Test if any files match with this base path
                                            const testMatch = glob.sync(effectivePattern, {
                                                cwd: folder,
                                                absolute: false,
                                                nodir: true,
                                            })

                                            if (testMatch.length > 0) {
                                                resolvedBasePath = folder
                                                aliasBaseResolved = true
                                                break
                                            }
                                        } catch (error) {
                                            // Continue to next folder on error
                                        }
                                    }
                                }
                            }

                            if (!aliasBaseResolved) {
                                console.warn(`Could not resolve base path for alias pattern: ${filePath}`, 'TRPC Generator')
                            }
                        }

                        // Handle glob pattern matching
                        if (
                            effectivePattern.includes('*') ||
                            effectivePattern.includes('?') ||
                            effectivePattern.includes('{') ||
                            effectivePattern.includes('[')
                        ) {
                            // Ensure we're only matching TypeScript files
                            let patternWithTsFilter = effectivePattern
                            if (
                                !effectivePattern.endsWith('.ts') &&
                                !effectivePattern.includes('.ts?') &&
                                !effectivePattern.includes('.{ts,') &&
                                !effectivePattern.includes('*.ts')
                            ) {
                                // If pattern already has a file extension pattern, modify it
                                if (effectivePattern.includes('*.*')) {
                                    patternWithTsFilter = effectivePattern.replace('*.*', '*.ts')
                                } else if (effectivePattern.endsWith('*')) {
                                    // Pattern ends with * (e.g. "zod/**/*"), append .ts
                                    patternWithTsFilter = `${effectivePattern}.ts`
                                } else {
                                    // Otherwise, append /*.ts if it's a directory-like pattern
                                    patternWithTsFilter = `${effectivePattern}${effectivePattern.endsWith('/') ? '' : '/'}*.ts`
                                }
                            }

                            try {
                                const matchedFiles = glob.sync(patternWithTsFilter, {
                                    cwd: resolvedBasePath,
                                    absolute: false,
                                    nodir: true,
                                    ignore: ['node_modules/**/*'],
                                })

                                // Additional filter to ensure we only get .ts files
                                const tsFiles = matchedFiles.filter((file) => file.endsWith('.ts'))

                                // Resolve relative to the base path
                                const resolvedPaths = tsFiles.map((file) => path.join(resolvedBasePath, file))
                                expandedFilePaths.push(...resolvedPaths)

                                // If no files found, provide more helpful output
                                if (resolvedPaths.length === 0) {
                                    console.warn(
                                        `No TypeScript files found for pattern '${filePath}' (resolved to '${patternWithTsFilter}' in ${resolvedBasePath})`,
                                        'TRPC Generator'
                                    )
                                }
                            } catch (error) {
                                console.warn(`Error expanding glob pattern ${filePath}: ${String(error)}`, 'TRPC Generator')
                            }
                        } else {
                            // Regular file path, add as is
                            expandedFilePaths.push(filePath)
                        }
                    }

                    // Process all expanded file paths
                    for (const filePath of expandedFilePaths) {
                        const resolvedPath = FileScanner.resolvePathWithAliases(
                            filePath,
                            pathAliases,
                            path.dirname(tsConfigFilePath),
                            moduleCallerFilePath
                        )

                        if (resolvedPath && fs.existsSync(resolvedPath)) {
                            try {
                                const fileContent = fs.readFileSync(resolvedPath, 'utf8')

                                const existingImports = new Set<string>()
                                sourceFile.getImportDeclarations().forEach((importDecl) => {
                                    const moduleSpecifier = importDecl.getModuleSpecifierValue()
                                    existingImports.add(moduleSpecifier)

                                    // Track default imports
                                    const defaultImport = importDecl.getDefaultImport()
                                    if (defaultImport) {
                                        existingImports.add(`${moduleSpecifier}:default:${defaultImport.getText()}`)
                                    }

                                    // Track named imports
                                    importDecl.getNamedImports().forEach((namedImport) => {
                                        existingImports.add(`${moduleSpecifier}:named:${namedImport.getName()}`)
                                    })
                                })

                                const importRegex = /import\s+{([^}]*)}\s+from\s+['"]([^'"]+)['"];?\s*/g
                                let match
                                let nonImportContent = fileContent

                                const processedImports = new Set<string>()
                                while ((match = importRegex.exec(fileContent)) !== null) {
                                    const namedImportsText = match[1]
                                    const moduleSpecifier = match[2]

                                    processedImports.add(match[0])

                                    const namedImports = namedImportsText
                                        .split(',')
                                        .map((imp) => imp.trim())
                                        .filter((imp) => imp !== '')

                                    namedImports.forEach((namedImport) => {
                                        // Check if this is actually a default import (e.g., "z" from "zod")
                                        const existingDefaultImportKey = `${moduleSpecifier}:default:${namedImport}`
                                        const isNameConflictWithDefault = existingImports.has(existingDefaultImportKey)

                                        const importKey = `${moduleSpecifier}:named:${namedImport}`

                                        // Skip if there's a conflict with an existing default import
                                        if (isNameConflictWithDefault) {
                                            return
                                        }

                                        if (!existingImports.has(importKey)) {
                                            if (!existingImports.has(moduleSpecifier)) {
                                                sourceFile.addImportDeclaration({
                                                    moduleSpecifier,
                                                    namedImports: [namedImport],
                                                })
                                                existingImports.add(moduleSpecifier)
                                            } else {
                                                const existingImport = sourceFile.getImportDeclaration(
                                                    (decl) => decl.getModuleSpecifierValue() === moduleSpecifier
                                                )
                                                if (existingImport) {
                                                    existingImport.addNamedImport(namedImport)
                                                }
                                            }
                                            existingImports.add(importKey)
                                        }
                                    })
                                }

                                processedImports.forEach((importStatement) => {
                                    nonImportContent = nonImportContent.replace(importStatement, '')
                                })

                                nonImportContent = nonImportContent
                                    .replace(/;\s*;/g, ';')
                                    .replace(/^\s*;/gm, '')
                                    .replace(/\s*;\s*\n/g, '\n')

                                const cleanedContent = nonImportContent.trim()
                                if (cleanedContent) {
                                    sourceFile.addStatements(`${cleanedContent}`)
                                }
                            } catch (error) {
                                console.warn(`Error injecting file ${filePath} (resolved to ${resolvedPath}): ${String(error)}`, 'TRPC Generator')
                            }
                        } else {
                            console.warn(`Could not resolve path for ${filePath} or file doesn't exist`, 'TRPC Generator')
                        }
                    }
                } catch (parseError) {
                    console.warn(`Error parsing tsconfig.json: ${String(parseError)}`, 'TRPC Generator')
                }
            } else {
                console.warn('Could not find tsconfig.json file', 'TRPC Generator')
            }
        } catch (error) {
            console.warn(`Error injecting files: ${String(error)}`, 'TRPC Generator')
        }

        await Promise.resolve()
    }
}
