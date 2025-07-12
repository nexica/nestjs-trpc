import { ContextOptions, TRPCContext } from './context.interface'
import type { Class } from 'type-fest'
import type { WebSocketServer } from 'ws'

export interface TRPCModuleOptions<TAppContext extends ContextOptions = ContextOptions> {
    context?: Class<TRPCContext<TAppContext>>
    outputPath?: string
    injectFiles?: Array<string>
    generateSchemas?: boolean
    basePath?: string
    transformer?: any
    // WebSocket options for subscription support
    websocket?: {
        wss?: WebSocketServer
        port?: number
        path?: string
        enabled?: boolean
    }
}

export interface SchemaImports {
    name: string
    path: string
}
