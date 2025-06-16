import { ContextOptions, TRPCContext } from './context.interface'
import type { Class } from 'type-fest'

export interface TRPCModuleOptions<TAppContext extends ContextOptions = ContextOptions> {
    context?: Class<TRPCContext<TAppContext>>
    outputPath?: string
    injectFiles?: Array<string>
    generateSchemas?: boolean
    basePath?: string
    transformer?: any
}

export interface SchemaImports {
    name: string
    path: string
}
