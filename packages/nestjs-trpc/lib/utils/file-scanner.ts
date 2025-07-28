import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import { Project, SourceFile, ts } from 'ts-morph'
import { ErrorHandler } from './error-handler'

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

        ErrorHandler.logWarning('FileScanner', `Could not find project root, using ${startDir} as fallback`)
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
                    const target = targets[0].replace(/\*/g, '')
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
                ErrorHandler.logWarning('FileScanner', `Could not resolve module: ${filePath}`)
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

        ErrorHandler.logWarning('FileScanner', `Could not resolve path with aliases, returning as is: ${filePath}`)
        return filePath
    }

    public static injectFilesContent(filePaths: Array<string>, sourceFile: SourceFile, moduleCallerFilePath: string): void {
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
                                    const target = targets[0].replace(/\*/g, '')
                                    resolvedBasePath = path.resolve(tsConfigDir, target)
                                    effectivePattern = filePath.replace('@/', '')
                                    aliasBaseResolved = true
                                    break
                                }
                            }

                            if (!aliasBaseResolved) {
                                ErrorHandler.logWarning('FileScanner', `Could not resolve base path for alias pattern: ${filePath}`)
                                continue
                            }
                        }

                        // Check if the pattern contains glob characters
                        const isGlob = filePath.includes('*') || filePath.includes('?') || filePath.includes('[')

                        if (isGlob) {
                            try {
                                const globMatches = glob.sync(effectivePattern, {
                                    cwd: resolvedBasePath,
                                    absolute: true,
                                })

                                const filteredMatches = globMatches.filter((match) => match.endsWith('.ts') || match.endsWith('.js'))

                                expandedFilePaths.push(...filteredMatches)
                            } catch (error) {
                                ErrorHandler.logWarning('FileScanner', `Error expanding glob pattern ${filePath}`, error)
                            }
                        } else {
                            const resolvedPath = this.resolvePathWithAliases(filePath, pathAliases, tsConfigDir, moduleCallerFilePath)
                            if (resolvedPath) {
                                expandedFilePaths.push(resolvedPath)
                            }
                        }
                    }

                    // Now inject the contents of all resolved files
                    for (const resolvedPath of expandedFilePaths) {
                        if (fs.existsSync(resolvedPath)) {
                            try {
                                const content = fs.readFileSync(resolvedPath, 'utf8')
                                sourceFile.addStatements(content)
                            } catch (error) {
                                ErrorHandler.logWarning('FileScanner', `Error injecting file ${resolvedPath}`, error)
                            }
                        } else {
                            ErrorHandler.logWarning('FileScanner', `Could not resolve path for ${resolvedPath} or file doesn't exist`)
                        }
                    }
                } catch (parseError) {
                    ErrorHandler.logWarning('FileScanner', `Error parsing tsconfig.json`, parseError)
                }
            } else {
                ErrorHandler.logWarning('FileScanner', 'Could not find tsconfig.json file')
            }
        } catch (error) {
            ErrorHandler.logWarning('FileScanner', `Error injecting files`, error)
        }
    }
}
