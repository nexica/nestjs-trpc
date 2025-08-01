import { Injectable } from '@nestjs/common'
import { ContextOptions, TRPCContext, EnhancedContext } from '../interfaces/context.interface'
import {
    ContextUtils,
    isExpressContext,
    isFastifyContext,
    isWebSocketContext,
    isEnhancedExpressContext,
    isEnhancedFastifyContext,
    isEnhancedWebSocketContext,
} from '../utils/context-utils'

/**
 * Enhanced context factory that automatically injects utility methods into the context
 */
@Injectable()
export class EnhancedContextFactory implements TRPCContext<EnhancedContext> {
    create(opts: ContextOptions): EnhancedContext {
        // Determine context type for discriminator
        const contextType = isWebSocketContext(opts) ? 'websocket' : isFastifyContext(opts) ? 'fastify' : 'express'

        // Create enhanced context with utility methods
        const enhancedContext: EnhancedContext = {
            // Spread all original context properties
            ...opts,

            // Add discriminator
            _contextType: contextType,

            // Connection type detection methods
            isWebSocketRequest: () => ContextUtils.isWebSocketRequest(opts),
            isHttpRequest: () => ContextUtils.isHttpRequest(opts),
            getConnectionType: () => ContextUtils.getConnectionType(opts),

            // Header and token extraction methods
            getAuthorizationHeader: () => ContextUtils.getAuthorizationHeader(opts),
            getBearerToken: () => ContextUtils.getBearerToken(opts),
            getHeader: (headerName: string) => ContextUtils.getHeader(opts, headerName),

            // Client information methods
            getClientIP: () => ContextUtils.getClientIP(opts),
            getUserAgent: () => ContextUtils.getUserAgent(opts),

            // Type guards for specific context types
            isExpressContext: function (this: EnhancedContext) {
                return isEnhancedExpressContext(this)
            },
            isFastifyContext: function (this: EnhancedContext) {
                return isEnhancedFastifyContext(this)
            },
            isWebSocketContext: function (this: EnhancedContext) {
                return isEnhancedWebSocketContext(this)
            },
        } as EnhancedContext

        return enhancedContext
    }
}

/**
 * Generic enhanced context factory that allows extending with custom properties
 */
@Injectable()
export class GenericEnhancedContextFactory<TCustomContext = Record<string, unknown>> implements TRPCContext<EnhancedContext & TCustomContext> {
    constructor(private readonly customContextCreator?: (opts: ContextOptions) => TCustomContext | Promise<TCustomContext>) {}

    async create(opts: ContextOptions): Promise<EnhancedContext & TCustomContext> {
        // Determine context type for discriminator
        const contextType = isWebSocketContext(opts) ? 'websocket' : isFastifyContext(opts) ? 'fastify' : 'express'

        // Create base enhanced context
        const baseEnhancedContext: EnhancedContext = {
            ...opts,
            _contextType: contextType,
            isWebSocketRequest: () => ContextUtils.isWebSocketRequest(opts),
            isHttpRequest: () => ContextUtils.isHttpRequest(opts),
            getConnectionType: () => ContextUtils.getConnectionType(opts),
            getAuthorizationHeader: () => ContextUtils.getAuthorizationHeader(opts),
            getBearerToken: () => ContextUtils.getBearerToken(opts),
            getHeader: (headerName: string) => ContextUtils.getHeader(opts, headerName),
            getClientIP: () => ContextUtils.getClientIP(opts),
            getUserAgent: () => ContextUtils.getUserAgent(opts),
            isExpressContext: function (this: EnhancedContext) {
                return isEnhancedExpressContext(this)
            },
            isFastifyContext: function (this: EnhancedContext) {
                return isEnhancedFastifyContext(this)
            },
            isWebSocketContext: function (this: EnhancedContext) {
                return isEnhancedWebSocketContext(this)
            },
        } as EnhancedContext

        // Add custom context properties if provided
        let customContext: TCustomContext
        if (this.customContextCreator) {
            customContext = await this.customContextCreator(opts)
        } else {
            customContext = {} as TCustomContext
        }

        return {
            ...baseEnhancedContext,
            ...customContext,
        } as EnhancedContext & TCustomContext
    }
}

/**
 * Utility function to create an enhanced context factory with custom properties
 */
export function createEnhancedContextFactory<TCustomContext = Record<string, unknown>>(
    customContextCreator?: (opts: ContextOptions) => TCustomContext | Promise<TCustomContext>
): GenericEnhancedContextFactory<TCustomContext> {
    return new GenericEnhancedContextFactory(customContextCreator)
}
