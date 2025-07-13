import { ContextOptions, TRPCContext } from './context.interface'
import type { Class } from 'type-fest'
import type { WebSocketServer } from 'ws'
import { DataTransformer } from '@trpc/server/unstable-core-do-not-import'

export interface TRPCModuleOptions<TAppContext extends ContextOptions = ContextOptions> {
    context?: Class<TRPCContext<TAppContext>>
    outputPath?: string
    injectFiles?: Array<string>
    generateSchemas?: boolean
    basePath?: string
    transformer?: DataTransformer
    websocket?: {
        wss?: WebSocketServer
        port?: number
        path?: string
        enabled?: boolean
    }
    driver?: 'express' | 'fastify'
}

export interface SchemaImports {
    name: string
    path: string
}
