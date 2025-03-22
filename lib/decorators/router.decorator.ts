import 'reflect-metadata'
import { TRPC_ROUTER_METADATA } from '../constants'
import { RouterDecoratorMetadata } from '../interfaces/decorators.interface'

export interface RouterOptions {
    path?: string
    alias?: string
}

export function Router(options: RouterOptions = {}): ClassDecorator {
    return (target) => {
        const metadata: RouterDecoratorMetadata = {
            target: target as object,
            path: options.path,
            alias: options.alias,
        }

        Reflect.defineMetadata(TRPC_ROUTER_METADATA, metadata, target)

        return target
    }
}
