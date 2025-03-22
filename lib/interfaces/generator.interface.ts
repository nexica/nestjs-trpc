import { SourceFile } from 'ts-morph'

export interface GeneratorModuleOptions {
    outputDirPath?: string
    rootModuleFilePath?: string
    injectFiles?: string[]
    context?: any
}

export interface RouterSchemaMetadata {
    name: string
    path?: string
    alias?: string
    instance: any
    procedures: ProcedureSchemaMetadata[]
}

export interface ProcedureSchemaMetadata {
    name: string
    type: 'query' | 'mutation'
    path?: string
    input?: InputSchemaMetadata
    output?: OutputSchemaMetadata
    middleware?: MiddlewareSchemaMetadata
}

export interface InputSchemaMetadata {
    type: string
    isOptional?: boolean
}

export interface OutputSchemaMetadata {
    type: string
}

export interface MiddlewareSchemaMetadata {
    middlewares: string[]
}

export interface SourceFileImportsMap {
    path: string
    sourceFile: SourceFile
    imports: Map<string, string>
}
