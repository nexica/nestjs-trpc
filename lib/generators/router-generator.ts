import { Optional } from '@nestjs/common'
import { Inject } from '@nestjs/common'

import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { Project, SourceFile, ts } from 'ts-morph'
import { TRPCModuleOptions } from '../interfaces/options.interface'
import { TRPC_MODULE_CALLER_FILE_PATH } from '../constants'
import { TRPCFactory } from '../factory/trpc.factory'
import { z } from 'zod/v4'
import { AnyTRPCProcedure, AnyTRPCRouter, initTRPC, TRPCProcedureType } from '@trpc/server'
import { FileScanner } from '../utils/file-scanner'
import { SchemaGenerator } from './schema-generator'
import { ErrorHandler } from '../utils/error-handler'

type ZodTypeAny = z.ZodType

interface ProcedureInfo {
    type: TRPCProcedureType
    input?: ZodTypeAny
    output?: ZodTypeAny
    inputName?: string
    outputName?: string
    middlewares?: string[]
}

interface appRouterStructure {
    routers: Record<string, routerStructure>
}

interface routerStructure {
    procedures: Record<string, ProcedureInfo>
}

@Injectable()
export class RouterGenerator {
    private project: Project
    private sourceFile!: SourceFile
    private options: TRPCModuleOptions = {}
    private schemaGenerator: SchemaGenerator = new SchemaGenerator()

    constructor(
        @Inject(TRPC_MODULE_CALLER_FILE_PATH)
        @Optional()
        private readonly moduleCallerFilePath: string = process.cwd(),
        @Optional() private readonly trpcFactory?: TRPCFactory
    ) {
        this.project = new Project({
            compilerOptions: {
                target: ts.ScriptTarget.ES2019,
                module: ts.ModuleKind.CommonJS,
                emitDecoratorMetadata: true,
                experimentalDecorators: true,
                esModuleInterop: true,
            },
        })
    }

    setOptions(options: TRPCModuleOptions) {
        this.options = options
    }

    public async generate(): Promise<void> {
        const { outputPath, injectFiles } = this.options

        if (!outputPath) {
            ErrorHandler.logError('RouterGenerator', 'Output path is missing in options', this.options)
            throw ErrorHandler.createError('RouterGenerator', 'Output path is required')
        }

        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        this.sourceFile = this.project.createSourceFile(outputPath, '', { overwrite: true })

        this.addBaseImports()

        if (injectFiles && injectFiles.length > 0) {
            this.injectFiles(injectFiles)
        }

        try {
            const t = initTRPC.context().create()

            if (!this.trpcFactory) {
                throw ErrorHandler.createError('RouterGenerator', 'TRPCFactory not available')
            }
            const appRouter = await this.trpcFactory.createAppRouter(this.options, t.router, t.procedure)

            await this.generateCodeFromAppRouter(appRouter)
        } catch (error) {
            ErrorHandler.logError('RouterGenerator', 'Failed to generate app router with factory', error)
        }

        await this.saveFile()
    }

    private async generateCodeFromAppRouter(appRouter: AnyTRPCRouter): Promise<void> {
        const routerStructure = await Promise.resolve(this.analyzeRouterStructure(appRouter))

        if (this.options.generateSchemas) {
            this.schemaGenerator.clear()

            for (const [routerName, router] of Object.entries(routerStructure.routers)) {
                this.schemaGenerator.collectSchemas(routerName, router.procedures)
            }

            const sortedSchemas = this.schemaGenerator.topologicalSort()

            for (const schemaName of sortedSchemas) {
                const schemaInfo = this.schemaGenerator.schemaRegistry.get(schemaName)
                if (schemaInfo && !this.schemaGenerator.processedSchemas.has(schemaName)) {
                    this.sourceFile.addStatements(`export const ${schemaName} = ${schemaInfo.definition}; \n`)
                    this.sourceFile.addStatements(`export type ${schemaInfo.typeName} = z.infer<typeof ${schemaName}>; \n`)
                    this.schemaGenerator.processedSchemas.add(schemaName)
                }
            }
        }

        for (const [routerName, router] of Object.entries(routerStructure.routers)) {
            this.generateRouterFromStructure(routerName, router.procedures)
        }

        const routerNames = Object.keys(routerStructure.routers).map((name) => {
            // return `  ${name}: ${name}Router,`
            return `  ${name}Router,`
        })

        this.sourceFile.addStatements(`
      export const appRouter = router({
      ${routerNames.join('\n')}
      });
      
      export type AppRouter = typeof appRouter;
    `)
    }

    private analyzeRouterStructure(appRouter: AnyTRPCRouter): appRouterStructure {
        const result: appRouterStructure = { routers: {} }

        try {
            for (const [routerName, router] of Object.entries(appRouter) as [string, AnyTRPCRouter][]) {
                if (!routerName.endsWith('Router')) continue
                const routerStructure: routerStructure = { procedures: {} }

                // TODO: Update once trpc 11 types are fixed
                // bit hacky for now, seems there are some type issues with trpc 11.0.0
                // trpc 11.0.0 types suggest _def.inputs & _def.output are not available
                for (const [procName, proc] of Object.entries(router) as [string, AnyTRPCProcedure][]) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const procedureDef = proc._def as any
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const input = procedureDef.inputs[0] as ZodTypeAny | undefined
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const output = procedureDef.output as ZodTypeAny | undefined
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const inputName = procedureDef.inputName as string | undefined
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const outputName = procedureDef.outputName as string | undefined
                    routerStructure.procedures[procName] = {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        type: procedureDef.type,
                        input: input,
                        output: output,
                        inputName: inputName,
                        outputName: outputName,
                    }
                }

                result.routers[routerName.replace('Router', '')] = routerStructure
            }
        } catch (error) {
            ErrorHandler.logError('RouterGenerator', 'Error analyzing router structure', error)
        }

        return result
    }

    private generateRouterFromStructure(routerName: string, procedures: Record<string, ProcedureInfo>): void {
        const proceduresCode = Object.entries(procedures)
            .map(([procedureName, procedure]) => {
                let inputSchemaName: string
                if (procedure.input) {
                    inputSchemaName = this.options.generateSchemas
                        ? this.schemaGenerator.generateSchemaName(routerName, procedureName, 'Input')
                        : this.schemaGenerator.generateNestedSchemaNameSafeForRouter(procedure.input as z.ZodObject)
                } else {
                    inputSchemaName = 'z.unknown()'
                }

                let outputSchemaName: string
                if (procedure.output) {
                    outputSchemaName = this.options.generateSchemas
                        ? this.schemaGenerator.generateSchemaName(routerName, procedureName, 'Output')
                        : this.schemaGenerator.generateNestedSchemaNameSafeForRouter(procedure.output as z.ZodObject)
                } else {
                    outputSchemaName = 'z.unknown()'
                }

                let implementation: string
                if (procedure.type === 'subscription') {
                    implementation = `async function* () {
                        yield {} as z.infer<typeof ${outputSchemaName}>;
                    }`
                } else {
                    implementation = `async () => "" as any`
                }

                let procedureChain = 'publicProcedure'

                if (inputSchemaName !== 'z.unknown()') {
                    procedureChain += `.input(${inputSchemaName})`
                }

                if (procedure.type !== 'subscription' && outputSchemaName !== 'z.unknown()') {
                    procedureChain += `.output(${outputSchemaName})`
                }

                procedureChain += `.${procedure.type}(${implementation})`

                return `  ${procedureName}: ${procedureChain},`
            })
            .join('\n')

        this.sourceFile.addStatements(`
      const ${routerName}Router = router({
      ${proceduresCode}
      });
    `)
    }

    private addBaseImports(): void {
        this.sourceFile.addImportDeclaration({
            moduleSpecifier: '@trpc/server',
            namedImports: ['initTRPC'],
        })

        if (this.options.generateSchemas) {
            this.sourceFile.addImportDeclaration({
                moduleSpecifier: 'zod/v4',
                defaultImport: 'z',
            })
        }

        let transformerSetup: string | undefined = undefined
        if (this.options.transformer) {
            transformerSetup = this.generateTransformerSetup()
        }

        const initTRPCConfig = this.options.transformer ? `{ transformer: transformer }` : ''

        this.sourceFile.addStatements(/* ts */ `
      ${transformerSetup}
      const t = initTRPC.create(${initTRPCConfig});
      const router = t.router;
      const publicProcedure = t.procedure;
    `)
    }

    private generateTransformerSetup(): string | undefined {
        if (!this.options.transformer) return undefined

        switch (this.options.transformer) {
            case 'superjson': {
                this.sourceFile.addImportDeclaration({
                    moduleSpecifier: 'superjson',
                    defaultImport: 'superjson',
                })
                return `const transformer = superjson;`
            }
            case 'devalue': {
                this.sourceFile.addImportDeclaration({
                    moduleSpecifier: 'devalue',
                    namedImports: ['stringify', 'parse'],
                })
                return `const transformer = { stringify, parse };`
            }
            default: {
                ErrorHandler.logWarning('RouterGenerator', 'Unknown transformer provided')
                return undefined
            }
        }
    }

    private getTransformerName(): string | undefined {
        return this.options.transformer
    }

    private injectFiles(filePaths: string[]): void {
        try {
            FileScanner.injectFilesContent(filePaths, this.sourceFile, this.moduleCallerFilePath)
        } catch (error) {
            ErrorHandler.logError('RouterGenerator', 'Error injecting files', error)
        }
    }

    private async saveFile(): Promise<void> {
        try {
            this.sourceFile.formatText({
                indentSize: 2,
                convertTabsToSpaces: true,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
                insertSpaceAfterKeywordsInControlFlowStatements: true,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
                insertSpaceAfterCommaDelimiter: true,
                insertSpaceAfterSemicolonInForStatements: true,
                placeOpenBraceOnNewLineForFunctions: false,
                placeOpenBraceOnNewLineForControlBlocks: false,
            })

            await this.sourceFile.save()
            await this.runPrettierIfAvailable()
        } catch (error) {
            ErrorHandler.logError('RouterGenerator', 'Error saving or formatting file', error)
        }
    }

    private async runPrettierIfAvailable(): Promise<void> {
        try {
            const { exec } = await import('child_process')
            const { promisify } = await import('util')
            const execAsync = promisify(exec)

            const outputPath = this.options.outputPath
            if (!outputPath) return

            await execAsync(`npx prettier --write "${outputPath}"`)
        } catch {
            return
        }
    }
}
