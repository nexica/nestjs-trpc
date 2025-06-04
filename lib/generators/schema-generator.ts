import * as fs from 'fs'
import * as path from 'path'
import { Project, SourceFile, ts } from 'ts-morph'
import { TRPCModuleOptions } from '../interfaces/options.interface'
import { Injectable, Inject, Optional } from '@nestjs/common'
import { FileScanner } from '../utils/file-scanner'
import { TRPC_MODULE_CALLER_FILE_PATH } from '../constants'
import { TRPCFactory } from '../factory/trpc.factory'
import { AnyTRPCProcedure, AnyTRPCRouter, initTRPC, TRPCProcedureType } from '@trpc/server'
import { z } from 'zod'

interface ProcedureInfo {
    type: TRPCProcedureType
    input?: z.ZodObject<any>
    output?: z.ZodObject<any>
    middlewares?: string[]
}

interface appRouterStructure {
    routers: Record<string, routerStructure>
}

interface routerStructure {
    procedures: Record<string, ProcedureInfo>
}

@Injectable()
export class SchemaGenerator {
    private project: Project
    private sourceFile!: SourceFile
    private options: TRPCModuleOptions = {}

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

    zodToString(schema) {
      if (schema?.constructor?.name === 'ZodObject') {
        const shape = schema._def.shape();
        if (Object.keys(shape).length === 0) return 'z.object({}).passthrough()';
    
        const fields = Object.entries(shape).map(
          ([key, val]) => `${key}: ${this.zodToString(val)}`
        );
        return `z.object({ ${fields.join(', ')} })`;
      }
    
      switch (schema?.constructor?.name) {
        case 'ZodString':
          return 'z.string()';
    
        case 'ZodNumber':
          return 'z.number()';
    
        case 'ZodBoolean':
          return 'z.boolean()';
    
        case 'ZodArray':
          return `z.array(${this.zodToString(schema._def.type)})`;
    
        case 'ZodLiteral':
          return `z.literal(${JSON.stringify(schema._def.value)})`;
    
        case 'ZodEnum':
          return `z.enum([${schema._def.values.map(v => JSON.stringify(v)).join(', ')}])`;
    
        case 'ZodNativeEnum': {
          const enumName = schema._def.type?.name || 'MyEnum';
          return `z.nativeEnum(${enumName})`;
        }
    
        case 'ZodNullable':
          return `z.nullable(${this.zodToString(schema._def.innerType)})`;
    
        case 'ZodOptional':
          return `z.optional(${this.zodToString(schema._def.innerType)})`;
    
        case 'ZodUnion':
          return `z.union([${schema._def.options.map(opt => this.zodToString(opt)).join(', ')}])`;
    
        case 'ZodTuple':
          return `z.tuple([${schema._def.items.map(item => this.zodToString(item)).join(', ')}])`;
    
        case 'ZodDefault':
          return `${this.zodToString(schema._def.innerType)}.default(${JSON.stringify(schema._def.defaultValue())})`;
    
        default:
          return 'z.any()';
      }
    }

    generateRouterFromStructure(routerName, procedures) {
      const proceduresCode = Object.entries(procedures)
        .map(([procedureName, procedure]) => {
          const inputCode = this.zodToString(procedure.input);
          const outputCode = this.zodToString(procedure.output);
    
          return [
            `  ${procedureName}: publicProcedure`,
            `    .input(${inputCode})`,
            `    .output(${outputCode})`,
            `    .${procedure.type}(async () => "" as any)`
          ].join('\n');
        })
        .join(',\n\n'); // newline between procedures
    
      const routerBlock = [
        `const ${routerName}Router = router({`,
        proceduresCode,
        `})`
      ].join('\n');
    
      console.log('proceduresCode:\n', proceduresCode);
      this.sourceFile.addStatements(routerBlock);
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
                    const input = procedureDef.inputs[0] as z.ZodObject<any> | undefined
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const output = procedureDef.output as z.ZodObject<any> | undefined
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
                return `  ${procedureName}: publicProcedure.input(${procedure.input?._def.description}).output(${procedure.output?._def.description}).${procedure.type}(async () => "" as any),`
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
            moduleSpecifier: 'zod',
            defaultImport: 'z',
        })

        this.sourceFile.addStatements(/* ts */ `
      const t = initTRPC.create();
      const router = t.router;
      const publicProcedure = t.procedure;
    `)
    }

    private injectFiles(filePaths: string[]): Promise<void> {
        return FileScanner.injectFilesContent(filePaths, this.sourceFile, this.moduleCallerFilePath)
    }

    private async saveFile(): Promise<void> {
        await this.sourceFile.save()
    }
}
