import { Injectable, Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { MiddlewareFn } from '../interfaces/middleware.interface'

/**
 * Interface for injectable middleware classes
 */
export interface InjectableMiddleware<TContext = any> {
    /**
     * The middleware function to be executed
     */
    use: MiddlewareFn<TContext>
}

/**
 * Injectable middleware registry that manages DI-compatible middleware
 */
@Injectable()
export class MiddlewareRegistry {
    private static moduleRef: ModuleRef
    private static middlewareCache = new Map<Type<InjectableMiddleware>, InjectableMiddleware>()

    static setModuleRef(moduleRef: ModuleRef): void {
        this.moduleRef = moduleRef
    }

    /**
     * Get or create a middleware instance using NestJS DI
     */
    static getMiddleware<T extends InjectableMiddleware>(MiddlewareClass: Type<T>): MiddlewareFn {
        if (!this.moduleRef) {
            throw new Error('MiddlewareRegistry not initialized. Make sure to import MiddlewareRegistryModule.')
        }

        // Check cache first
        if (this.middlewareCache.has(MiddlewareClass)) {
            const instance = this.middlewareCache.get(MiddlewareClass)!
            return (opts) => instance.use(opts)
        }

        // Get instance from NestJS DI container
        const instance = this.moduleRef.get(MiddlewareClass, { strict: false })
        this.middlewareCache.set(MiddlewareClass, instance)

        return (opts) => instance.use(opts)
    }

    /**
     * Create a middleware function that resolves dependencies at runtime
     * This is useful for middleware that need to access services
     */
    static createMiddleware<T extends InjectableMiddleware>(MiddlewareClass: Type<T>): MiddlewareFn {
        return this.getMiddleware(MiddlewareClass)
    }
}

/**
 * Module to initialize the middleware registry
 */
@Injectable()
export class MiddlewareRegistryModule {
    constructor(private readonly moduleRef: ModuleRef) {
        MiddlewareRegistry.setModuleRef(moduleRef)
    }
}

/**
 * Helper function to create a middleware reference for use with @Middleware() decorator
 * Returns a lazy middleware function that resolves dependencies at runtime
 */
export function createMiddleware<T extends InjectableMiddleware>(MiddlewareClass: Type<T>): MiddlewareFn {
    return async (opts) => {
        const middlewareFn = MiddlewareRegistry.getMiddleware(MiddlewareClass)
        return middlewareFn(opts)
    }
}

/**
 * Helper to create middleware factory functions with dependency injection
 */
export function createMiddlewareFactory<TDeps, TContext = any>(
    factory: (deps: TDeps) => MiddlewareFn<TContext>
): (deps: TDeps) => MiddlewareFn<TContext> {
    return factory
}

/**
 * Base class for injectable middleware with enhanced context support
 */
export abstract class BaseMiddleware<TContext = any> implements InjectableMiddleware<TContext> {
    abstract use: MiddlewareFn<TContext>
}
