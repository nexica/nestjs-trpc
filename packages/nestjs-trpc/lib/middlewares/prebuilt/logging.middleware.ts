import { Injectable } from '@nestjs/common'
import { EnhancedContext } from '../../interfaces/context.interface'
import { BaseMiddleware } from '../middleware'
import { MiddlewareFn } from '../../interfaces/middleware.interface'

/**
 * Logging middleware that works across all platforms
 */
@Injectable()
export class LoggingMiddleware extends BaseMiddleware<EnhancedContext> {
    readonly use: MiddlewareFn<EnhancedContext> = async (opts) => {
        const { ctx, next, path, type } = opts

        const connectionType = ctx.getConnectionType()
        const userAgent = ctx.getUserAgent()

        console.log(`🔗 [${connectionType.toUpperCase()}] ${type.toUpperCase()} ${path}`, {
            userAgent: userAgent?.substring(0, 50) + '...',
            timestamp: new Date().toISOString(),
        })

        const start = Date.now()
        try {
            const result = await next({ ctx })
            const duration = Date.now() - start
            console.log(`✅ [${connectionType.toUpperCase()}] ${path} completed in ${duration}ms`)
            return result
        } catch (error) {
            const duration = Date.now() - start
            console.error(`❌ [${connectionType.toUpperCase()}] ${path} failed after ${duration}ms:`, error)
            throw error
        }
    }
}
