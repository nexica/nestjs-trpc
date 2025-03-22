import 'reflect-metadata'
import * as fs from 'fs'
import { Project, SourceFile, ts } from 'ts-morph'
import { TRPC_ROUTER_METADATA, TRPC_PROCEDURE_METADATA, TRPC_INPUT_METADATA, TRPC_OUTPUT_METADATA, TRPC_MIDDLEWARE_METADATA } from '../constants'
import {
    RouterDecoratorMetadata,
    ProcedureDecoratorMetadata,
    InputDecoratorMetadata,
    MiddlewareDecoratorMetadata,
} from '../interfaces/decorators.interface'

export class MetadataReader {
    private project: Project

    constructor() {
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

    public initialize(tsConfigFilePath: string | null, files: string[]): void {
        if (tsConfigFilePath) {
            this.project.addSourceFilesFromTsConfig(tsConfigFilePath)
        } else {
            files.forEach((file) => {
                if (fs.existsSync(file)) {
                    this.project.addSourceFileAtPath(file)
                }
            })
        }
    }

    public findRouterClasses(): { sourceFile: SourceFile; className: string }[] {
        const routerClasses: { sourceFile: SourceFile; className: string }[] = []

        this.project.getSourceFiles().forEach((sourceFile) => {
            sourceFile.getClasses().forEach((classDeclaration) => {
                const decorators = classDeclaration.getDecorators()

                const hasRouterDecorator = decorators.some((decorator) => {
                    const name = decorator.getName()
                    return name === 'Router'
                })

                if (hasRouterDecorator) {
                    routerClasses.push({
                        sourceFile,
                        className: classDeclaration.getName() || '',
                    })
                }
            })
        })

        return routerClasses
    }

    public getRouterMetadata(target: object): RouterDecoratorMetadata | null {
        return (Reflect.getMetadata(TRPC_ROUTER_METADATA, target) as RouterDecoratorMetadata) || null
    }

    public getProcedureMetadata(target: object, methodName: string): ProcedureDecoratorMetadata | null {
        return (Reflect.getMetadata(TRPC_PROCEDURE_METADATA, target, methodName) as ProcedureDecoratorMetadata) || null
    }

    public getInputMetadata(target: object, methodName: string): InputDecoratorMetadata | null {
        return (Reflect.getMetadata(TRPC_INPUT_METADATA, target, methodName) as InputDecoratorMetadata) || null
    }

    public getMiddlewareMetadata(target: object, methodName: string): MiddlewareDecoratorMetadata | null {
        return (Reflect.getMetadata(TRPC_MIDDLEWARE_METADATA, target, methodName) as MiddlewareDecoratorMetadata) || null
    }
}
