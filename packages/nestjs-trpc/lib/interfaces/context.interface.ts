import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws'

export type ContextOptions = CreateExpressContextOptions | CreateFastifyContextOptions | CreateWSSContextFnOptions

export interface TRPCContext<TAppContext = Record<string, unknown>> {
    create(opts: ContextOptions): TAppContext | Promise<TAppContext>
}

/**
 * Base enhanced context with shared utility methods only
 */
type BaseEnhancedContext = {
    // Discriminator for proper type narrowing
    readonly _contextType: 'express' | 'fastify' | 'websocket'

    // Connection type detection
    isWebSocketRequest(): boolean
    isHttpRequest(): boolean
    getConnectionType(): 'express' | 'fastify' | 'websocket' | 'unknown'

    // Header and token extraction
    getAuthorizationHeader(): string | null
    getBearerToken(): string | null
    getHeader(headerName: string): string | string[] | null

    // Client information
    getClientIP(): string | null
    getUserAgent(): string | null

    // Type guards for specific context types (with proper type predicates)
    isExpressContext(): this is EnhancedExpressContext
    isFastifyContext(): this is EnhancedFastifyContext
    isWebSocketContext(): this is EnhancedWebSocketContext
}

/**
 * Enhanced Express context with utility methods
 */
export type EnhancedExpressContext = BaseEnhancedContext &
    CreateExpressContextOptions & {
        readonly _contextType: 'express'
    }

/**
 * Enhanced Fastify context with utility methods
 */
export type EnhancedFastifyContext = BaseEnhancedContext &
    CreateFastifyContextOptions & {
        readonly _contextType: 'fastify'
    }

/**
 * Enhanced WebSocket context with utility methods
 */
export type EnhancedWebSocketContext = BaseEnhancedContext &
    CreateWSSContextFnOptions & {
        readonly _contextType: 'websocket'
    }

/**
 * Enhanced context type with built-in utility methods for safe cross-platform access
 * This is a discriminated union that prevents access to platform-specific properties
 * outside of type guards
 */
export type EnhancedContext = EnhancedExpressContext | EnhancedFastifyContext | EnhancedWebSocketContext
