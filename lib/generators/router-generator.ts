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

type ZodTypeAny = z.ZodType

interface ProcedureInfo {
    type: TRPCProcedureType
    input?: ZodTypeAny
    output?: ZodTypeAny
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
            console.error('Output path is missing in options:', this.options)
            throw new Error('Output path is required')
        }

        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        this.sourceFile = this.project.createSourceFile(outputPath, '', { overwrite: true })

        this.addBaseImports()

        if (injectFiles && injectFiles.length > 0) {
            await this.injectFiles(injectFiles)
        }

        try {
            const t = initTRPC.context().create()

            if (!this.trpcFactory) {
                throw new Error('TRPCFactory not available')
            }
            const appRouter = await this.trpcFactory.createAppRouter(this.options, t.router, t.procedure)

            await this.generateCodeFromAppRouter(appRouter)
        } catch (error) {
            console.error('Failed to generate app router with factory:', error)
        }

        await this.saveFile()
    }

    private async generateCodeFromAppRouter(appRouter: AnyTRPCRouter): Promise<void> {
        const routerStructure = await Promise.resolve(this.analyzeRouterStructure(appRouter))

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
                    routerStructure.procedures[procName] = {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        type: procedureDef.type,
                        input: input,
                        output: output,
                    }
                }

                result.routers[routerName.replace('Router', '')] = routerStructure
            }
        } catch (error) {
            console.error('Error analyzing router structure:', error)
        }

        return result
    }

    private generateRouterFromStructure(routerName: string, procedures: Record<string, ProcedureInfo>): void {
        const proceduresCode = Object.entries(procedures)
            .map(([procedureName, procedure]) => {
                let inputSchemaName: string
                if (procedure.input) {
                    inputSchemaName = this.schemaGenerator.generateSchemaName(routerName, procedureName, 'Input')
                } else {
                    inputSchemaName = 'z.unknown()'
                }

                let outputSchemaName: string
                if (procedure.output) {
                    outputSchemaName = this.schemaGenerator.generateSchemaName(routerName, procedureName, 'Output')
                } else {
                    outputSchemaName = 'z.unknown()'
                }

                return `  ${procedureName}: publicProcedure.input(${inputSchemaName}).output(${outputSchemaName}).${procedure.type}(async () => "" as any),`
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

        this.sourceFile.addImportDeclaration({
            moduleSpecifier: 'zod/v4',
            defaultImport: 'z',
        })

        let transformerSetup = ''
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

    private generateTransformerSetup(): string {
        if (!this.options.transformer) return ''

        const transformerName = this.getTransformerName()

        switch (transformerName) {
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
                console.warn(`Unknown transformer detected. Please manually configure the transformer import in the generated file.`)
                return `// TODO: Add import for your transformer
// Example for superjson: import superjson from 'superjson';
// Example for other transformers: import yourTransformer from 'your-transformer-package';
const transformer = null; // Replace with your transformer`
            }
        }
    }

    private getTransformerName(): string {
        if (!this.options.transformer) return ''

        if (typeof this.options.transformer === 'string') {
            return this.options.transformer.toLowerCase()
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (this.options.transformer.serialize && this.options.transformer.deserialize) {
                return 'superjson'
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            const constructorName = this.options.transformer.constructor?.name
            if (constructorName && typeof constructorName === 'string') {
                const lowerName = constructorName.toLowerCase()
                if (lowerName.includes('superjson')) {
                    return 'superjson'
                }
                if (lowerName.includes('devalue')) {
                    return 'devalue'
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (this.options.transformer.stringify && this.options.transformer.parse) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
                const stringifyStr = this.options.transformer.stringify.toString()
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                if (stringifyStr.includes('devalue')) {
                    return 'devalue'
                }
                return 'superjson'
            }
        } catch (error) {
            console.warn('Error detecting transformer type:', error)
        }

        return ''
    }

    private injectFiles(filePaths: string[]): Promise<void> {
        return FileScanner.injectFilesContent(filePaths, this.sourceFile, this.moduleCallerFilePath)
    }

    private async saveFile(): Promise<void> {
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
