import 'reflect-metadata'
import { TRPC_MIDDLEWARE_METADATA, TRPC_ROUTER_MIDDLEWARE_METADATA } from '../constants'
import { MiddlewareDecoratorMetadata } from '../interfaces/decorators.interface'
import { AnyTRPCMiddlewareFunction } from '@trpc/server'

export function Middleware(...middlewares: Array<AnyTRPCMiddlewareFunction>): ClassDecorator & MethodDecorator {
    return function (
        target: object | (new (...args: any[]) => any),
        propertyKey?: string | symbol,
        descriptor?: TypedPropertyDescriptor<any>
    ): object | void | TypedPropertyDescriptor<any> {
        // Class decorator
        if (!propertyKey) {
            const metadata: MiddlewareDecoratorMetadata = {
                target,
                methodName: undefined,
                middlewares,
            }

            Reflect.defineMetadata(TRPC_ROUTER_MIDDLEWARE_METADATA, metadata, target)

            return target
        }

        // Method decorator
        const metadata: MiddlewareDecoratorMetadata = {
            target,
            methodName: propertyKey.toString(),
            middlewares,
        }

        Reflect.defineMetadata(TRPC_MIDDLEWARE_METADATA, metadata, (target as object).constructor, propertyKey)

        return descriptor
    } as ClassDecorator & MethodDecorator
}
