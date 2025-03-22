import { AnyTRPCRouter } from '@trpc/server'
import { Injectable, Inject, Optional } from '@nestjs/common'
import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { TRPC_ROUTER_METADATA, TRPC_PROCEDURE_METADATA, TRPC_MIDDLEWARE_METADATA, TRPC_ROUTER_MIDDLEWARE_METADATA } from '../constants'
import { TRPCModuleOptions } from '../interfaces/options.interface'
import { RouterDecoratorMetadata, ProcedureDecoratorMetadata, MiddlewareDecoratorMetadata } from '../interfaces/decorators.interface'
import { MiddlewareFn } from '../interfaces/middleware.interface'

type RouterFactory = (procedures: Record<string, any>) => AnyTRPCRouter
type ProcedureBuilder = {
    use: (middleware: MiddlewareFn) => ProcedureBuilder
    input: (schema: any) => ProcedureBuilder
    output: (schema: any) => ProcedureBuilder
    query: (handler: (...args: any[]) => any) => any
    mutation: (handler: (...args: any[]) => any) => any
}

@Injectable()
export class TRPCFactory {
    @Inject(DiscoveryService)
    @Optional()
    private readonly discovery?: DiscoveryService

    async createAppRouter(options: TRPCModuleOptions = {}, routerFactory: RouterFactory, procedureBuilder: ProcedureBuilder): Promise<AnyTRPCRouter> {
        if (!this.discovery) {
            console.warn('DiscoveryService is not available - unable to discover routers automatically. Returning empty router.')
            return routerFactory({})
        }

        try {
            const routerProviders = await this.discovery.providersWithMetaAtKey<RouterDecoratorMetadata>(TRPC_ROUTER_METADATA)

            if (!routerProviders.length) {
                console.warn('No router providers found, returning empty router')
                return routerFactory({})
            }

            const routers: Record<string, any> = {}

            for (const provider of routerProviders) {
                try {
                    const discoveredClass = provider.discoveredClass
                    const instance = discoveredClass?.instance
                    const metatype = discoveredClass?.injectType
                    const metadata = provider.meta

                    if (!instance || !metatype) {
                        console.warn('Skipping router - missing instance or metatype')
                        continue
                    }

                    type InstanceWithMethods = {
                        [key: string]: unknown
                    }

                    const typedInstance = instance as InstanceWithMethods

                    const routerMiddlewareMetadata = Reflect.getMetadata(TRPC_ROUTER_MIDDLEWARE_METADATA, metatype) as
                        | MiddlewareDecoratorMetadata
                        | undefined

                    let routerProcedureBuilder = procedureBuilder

                    if (routerMiddlewareMetadata?.middlewares?.length) {
                        for (const middleware of routerMiddlewareMetadata.middlewares) {
                            if (typeof middleware === 'string') {
                                const middlewareMethod = typedInstance[middleware]
                                if (typeof middlewareMethod === 'function') {
                                    const middlewareFn = middlewareMethod as (...args: any[]) => any
                                    routerProcedureBuilder = routerProcedureBuilder.use((opts) =>
                                        Promise.resolve(middlewareFn.call(typedInstance, opts))
                                    )
                                }
                            } else if (typeof middleware === 'function') {
                                routerProcedureBuilder = routerProcedureBuilder.use(middleware)
                            }
                        }
                    }

                    const procedures: Record<string, any> = {}
                    const methods = this.getMethodsWithProcedureMetadata(metatype, instance)

                    for (const methodName of methods) {
                        const procedureResult = this.createProcedureFromMethod(metatype, methodName, typedInstance, routerProcedureBuilder)

                        if (procedureResult) {
                            procedures[procedureResult.path] = procedureResult.procedure as unknown
                        }
                    }

                    if (Object.keys(procedures).length > 0) {
                        const routerName = metadata?.path || (typeof metatype === 'function' ? metatype.name : 'UnnamedRouter')
                        routers[routerName] = routerFactory(procedures)
                    }
                } catch (error) {
                    console.error('Error processing router:', error)
                }
            }

            return routerFactory(routers)
        } catch (error) {
            console.error('Error creating app router:', error)

            return routerFactory({})
        }
    }

    private getMethodsWithProcedureMetadata(target: object, instance: Record<string, any>): string[] {
        const methods: string[] = []

        const prototype = Object.getPrototypeOf(instance) as Record<string, any>
        const methodNames = Object.getOwnPropertyNames(prototype).filter((prop) => prop !== 'constructor' && typeof prototype[prop] === 'function')

        for (const method of methodNames) {
            const metadata = Reflect.getMetadata(TRPC_PROCEDURE_METADATA, target, method) as ProcedureDecoratorMetadata | undefined

            if (metadata) {
                methods.push(method)
            }
        }

        return methods
    }

    private createProcedureFromMethod(
        target: object,
        methodName: string,
        instance: Record<string, unknown>,
        procedureBuilder: ProcedureBuilder
    ): { procedure: any; path: string } | null {
        const procedureMetadata = Reflect.getMetadata(TRPC_PROCEDURE_METADATA, target, methodName) as ProcedureDecoratorMetadata | undefined

        if (!procedureMetadata) {
            return null
        }

        const middlewareMetadata = Reflect.getMetadata(TRPC_MIDDLEWARE_METADATA, target, methodName) as MiddlewareDecoratorMetadata | undefined

        let procedure = procedureBuilder

        const typedInstance = instance as {
            [key: string]: unknown
        }

        if (middlewareMetadata?.middlewares?.length) {
            for (const middleware of middlewareMetadata.middlewares) {
                if (typeof middleware === 'string') {
                    const middlewareMethod = typedInstance[middleware]
                    if (typeof middlewareMethod === 'function') {
                        const middlewareFn = middlewareMethod as (...args: any[]) => any
                        procedure = procedure.use((opts) => Promise.resolve(middlewareFn.call(typedInstance, opts)))
                    }
                } else if (typeof middleware === 'function') {
                    procedure = procedure.use(middleware)
                }
            }
        }

        if (procedureMetadata.input) {
            procedure = procedure.input(procedureMetadata.input)
        }

        if (procedureMetadata.output) {
            procedure = procedure.output(procedureMetadata.output)
        }

        const handler = (...args: any[]) => {
            const method = instance[methodName] as (...args: any[]) => any
            if (typeof method === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return method.apply(instance, args)
            }
            throw new Error(`Method ${methodName} is not a function`)
        }

        let finalProcedure
        if (procedureMetadata.type === 'query') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            finalProcedure = procedure.query(handler)
        } else if (procedureMetadata.type === 'mutation') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            finalProcedure = procedure.mutation(handler)
        }

        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            procedure: finalProcedure,
            path: methodName,
        }
    }
}
