import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws'
import { ContextOptions, EnhancedExpressContext, EnhancedFastifyContext, EnhancedWebSocketContext } from '../interfaces/context.interface'

/**
 * Interface for objects that have WebSocket connection parameters
 */
interface HasConnectionParams {
    info: {
        connectionParams: Record<string, unknown>
    }
}

/**
 * Type guard to check if an object has connection params structure
 */
function hasConnectionParams(obj: unknown): obj is HasConnectionParams {
    if (typeof obj !== 'object' || obj === null) {
        return false
    }

    if (!('info' in obj)) {
        return false
    }

    const objWithInfo = obj as { info: unknown }
    if (typeof objWithInfo.info !== 'object' || objWithInfo.info === null) {
        return false
    }

    const info = objWithInfo.info as Record<string, unknown>
    if (!('connectionParams' in info)) {
        return false
    }

    return typeof info.connectionParams === 'object' && info.connectionParams !== null
}

/**
 * Type guards for detecting different context types
 */
export function isWebSocketContext(ctx: ContextOptions): ctx is CreateWSSContextFnOptions {
    // WebSocket contexts have 'info' property - check this FIRST as it's most specific
    return 'info' in ctx
}

export function isFastifyContext(ctx: ContextOptions): ctx is CreateFastifyContextOptions {
    // Fastify has 'reply' property (and usually 'req' too)
    return 'reply' in ctx && 'req' in ctx && !('info' in ctx)
}

export function isExpressContext(ctx: ContextOptions): ctx is CreateExpressContextOptions {
    // Express has 'req' and 'res' but no 'reply' or 'info'
    return 'req' in ctx && 'res' in ctx && !('reply' in ctx) && !('info' in ctx)
}

/**
 * Enhanced context type guards with proper type narrowing for EnhancedContext
 * These should be used with EnhancedContext types for proper TypeScript narrowing
 */
export function isEnhancedExpressContext(ctx: ContextOptions): ctx is EnhancedExpressContext {
    return isExpressContext(ctx)
}

export function isEnhancedFastifyContext(ctx: ContextOptions): ctx is EnhancedFastifyContext {
    return isFastifyContext(ctx)
}

export function isEnhancedWebSocketContext(ctx: ContextOptions): ctx is EnhancedWebSocketContext {
    return isWebSocketContext(ctx)
}

/**
 * Context utility functions for safely accessing headers and tokens across all context types
 */
export class ContextUtils {
    /**
     * Safely extract authorization header from any context type
     */
    static getAuthorizationHeader(ctx: ContextOptions): string | null {
        // Check WebSocket first (most specific)
        if (isWebSocketContext(ctx)) {
            // For WebSocket, token is typically in connection params from info
            // Note: This depends on how you set up WebSocket authentication in your app
            // The exact structure may vary based on your WebSocket setup
            if (hasConnectionParams(ctx)) {
                const connectionParams = ctx.info.connectionParams
                const token = connectionParams.token || connectionParams.authorization
                if (typeof token === 'string') {
                    // If it's already a bearer token, return as-is
                    if (token.startsWith('Bearer ')) {
                        return token
                    }
                    // Otherwise, format it as Bearer token
                    return `Bearer ${token}`
                }
            }
            return null
        }

        // Check Fastify
        if (isFastifyContext(ctx)) {
            return ctx.req.headers.authorization || null
        }

        // Check Express (fallback)
        if (isExpressContext(ctx)) {
            return ctx.req.headers.authorization || null
        }

        return null
    }

    /**
     * Extract Bearer token from authorization header
     */
    static getBearerToken(ctx: ContextOptions): string | null {
        const authHeader = this.getAuthorizationHeader(ctx)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null
        }
        return authHeader.slice(7) // Remove 'Bearer ' prefix
    }

    /**
     * Get request header value by name (case-insensitive)
     */
    static getHeader(ctx: ContextOptions, headerName: string): string | string[] | null {
        const lowerHeaderName = headerName.toLowerCase()

        // Check WebSocket first (most specific)
        if (isWebSocketContext(ctx)) {
            // WebSocket doesn't have traditional headers, but might have them in connectionParams
            if (hasConnectionParams(ctx)) {
                const connectionParams = ctx.info.connectionParams
                if (connectionParams && typeof connectionParams === 'object' && connectionParams !== null) {
                    const headerValue = (connectionParams as Record<string, unknown>)[lowerHeaderName]
                    return Array.isArray(headerValue) || typeof headerValue === 'string' ? headerValue : null
                }
            }
            return null
        }

        // Check Fastify (has 'reply' property)
        if (isFastifyContext(ctx)) {
            return ctx.req.headers[lowerHeaderName] || null
        }

        // Check Express (fallback for HTTP contexts)
        if (isExpressContext(ctx)) {
            return ctx.req.headers[lowerHeaderName] || null
        }

        return null
    }

    /**
     * Get client IP address from context
     */
    static getClientIP(ctx: ContextOptions): string | null {
        // Check WebSocket first (most specific)
        if (isWebSocketContext(ctx)) {
            // WebSocket IP might be available in connectionParams or not at all
            if (hasConnectionParams(ctx)) {
                const connectionParams = ctx.info.connectionParams
                const ip = connectionParams.ip
                return typeof ip === 'string' ? ip : null
            }
            return null
        }

        // Check Fastify
        if (isFastifyContext(ctx)) {
            return ctx.req.ip || ctx.req.socket?.remoteAddress || null
        }

        // Check Express (fallback)
        if (isExpressContext(ctx)) {
            // Check various headers for real IP (reverse proxy, load balancer)
            const xForwardedFor = ctx.req.headers['x-forwarded-for']
            if (xForwardedFor) {
                const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor
                return ips.split(',')[0].trim()
            }
            return (ctx.req.headers['x-real-ip'] as string) || ctx.req.socket?.remoteAddress || null
        }

        return null
    }

    /**
     * Get User-Agent string from context
     */
    static getUserAgent(ctx: ContextOptions): string | null {
        return (this.getHeader(ctx, 'user-agent') as string) || null
    }

    /**
     * Check if the request is from a WebSocket connection
     */
    static isWebSocketRequest(ctx: ContextOptions): boolean {
        return isWebSocketContext(ctx)
    }

    /**
     * Check if the request is from an HTTP connection (Express or Fastify)
     */
    static isHttpRequest(ctx: ContextOptions): boolean {
        return isExpressContext(ctx) || isFastifyContext(ctx)
    }

    /**
     * Get connection type as string for logging
     */
    static getConnectionType(ctx: ContextOptions): 'express' | 'fastify' | 'websocket' | 'unknown' {
        if (isWebSocketContext(ctx)) return 'websocket'
        if (isFastifyContext(ctx)) return 'fastify'
        if (isExpressContext(ctx)) return 'express'
        return 'unknown'
    }
}
