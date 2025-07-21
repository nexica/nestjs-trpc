import { AnyTRPCProcedure, AnyTRPCRouter, AnyQueryProcedure, AnyMutationProcedure, AnySubscriptionProcedure } from '@trpc/server'
import { Injectable, Inject, Optional } from '@nestjs/common'
import { DiscoveryService } from '@golevelup/nestjs-discovery'
import {
    TRPC_ROUTER_METADATA,
    TRPC_PROCEDURE_METADATA,
    TRPC_MIDDLEWARE_METADATA,
    TRPC_ROUTER_MIDDLEWARE_METADATA,
    TRPC_INPUT_PARAM_METADATA,
    TRPC_CONTEXT_PARAM_METADATA,
} from '../constants'
import { TRPCModuleOptions } from '../interfaces/options.interface'
import { RouterDecoratorMetadata, ProcedureDecoratorMetadata, MiddlewareDecoratorMetadata } from '../interfaces/decorators.interface'
import { MiddlewareFn } from '../interfaces/middleware.interface'
import { ErrorHandler } from '../utils/error-handler'
import { RouterFactory, ClassInstance, InstanceMethod, ProcedureHandler } from '../types/trpc-types'
import { AnyProcedureBuilder } from '@trpc/server/unstable-core-do-not-import'

@Injectable()
export class TRPCFactory {
    @Inject(DiscoveryService)
    @Optional()
    private readonly discovery?: DiscoveryService

    async createAppRouter(
        options: TRPCModuleOptions = {},
        routerFactory: RouterFactory,
        procedureBuilder: AnyProcedureBuilder
    ): Promise<AnyTRPCRouter> {
        if (!this.discovery) {
            ErrorHandler.logWarning(
                'TRPCFactory',
                'DiscoveryService is not available - unable to discover routers automatically. Returning empty router.'
            )
            return routerFactory({})
        }

        try {
            const routerProviders = await this.discovery.providersWithMetaAtKey<RouterDecoratorMetadata>(TRPC_ROUTER_METADATA)

            if (!routerProviders.length) {
                ErrorHandler.logWarning('TRPCFactory', 'No router providers found, returning empty router')
                return routerFactory({})
            }

            const routers: Record<string, AnyTRPCRouter> = {}

            for (const provider of routerProviders) {
                try {
                    const discoveredClass = provider.discoveredClass
                    const instance = discoveredClass?.instance
                    const metatype = discoveredClass?.injectType
                    const metadata = provider.meta

                    if (!instance || !metatype) {
                        ErrorHandler.logWarning('TRPCFactory', 'Skipping router - missing instance or metatype')
                        continue
                    }

                    const typedInstance = instance as ClassInstance

                    const routerMiddlewareMetadata = Reflect.getMetadata(TRPC_ROUTER_MIDDLEWARE_METADATA, metatype) as
                        | MiddlewareDecoratorMetadata
                        | undefined

                    let routerProcedureBuilder = procedureBuilder

                    if (routerMiddlewareMetadata?.middlewares?.length) {
                        for (const middleware of routerMiddlewareMetadata.middlewares) {
                            if (typeof middleware === 'string') {
                                const middlewareMethod = typedInstance[middleware]
                                if (typeof middlewareMethod === 'function') {
                                    const middlewareFn = middlewareMethod as InstanceMethod
                                    routerProcedureBuilder = routerProcedureBuilder.use(async (opts) => {
                                        await middlewareFn.call(typedInstance, opts)
                                        return opts.next()
                                    })
                                }
                            } else if (typeof middleware === 'function') {
                                routerProcedureBuilder = routerProcedureBuilder.use(middleware)
                            }
                        }
                    }

                    const procedures: Record<string, AnyTRPCProcedure> = {}
                    const methods = this.getMethodsWithProcedureMetadata(metatype, instance as ClassInstance)

                    for (const methodName of methods) {
                        const procedureResult = this.createProcedureFromMethod(metatype, methodName, typedInstance, routerProcedureBuilder)

                        if (procedureResult) {
                            procedures[procedureResult.path] = procedureResult.procedure
                        }
                    }

                    if (Object.keys(procedures).length > 0) {
                        const routerName = metadata?.path || (typeof metatype === 'function' ? metatype.name : 'UnnamedRouter')
                        routers[routerName] = routerFactory(procedures)
                    }
                } catch (error) {
                    ErrorHandler.logError('TRPCFactory', 'Error processing router', error)
                }
            }

            return routerFactory(routers)
        } catch (error) {
            ErrorHandler.logError('TRPCFactory', 'Error creating app router', error)
            return routerFactory({})
        }
    }

    private getMethodsWithProcedureMetadata(target: object, instance: ClassInstance): string[] {
        const methods: string[] = []

        const prototype = Object.getPrototypeOf(instance) as ClassInstance
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
        instance: ClassInstance,
        procedureBuilder: AnyProcedureBuilder
    ): { procedure: AnyTRPCProcedure; path: string } | null {
        const procedureMetadata = this.getProcedureMetadata(target, methodName)
        if (!procedureMetadata) {
            return null
        }

        const procedure = this.applyMiddleware(target, methodName, instance, procedureBuilder)
        const configuredProcedure = this.configureInputOutput(procedure, procedureMetadata)
        const handler = this.createProcedureHandler(target, methodName, instance)
        const finalProcedure = this.createFinalProcedure(configuredProcedure, handler, procedureMetadata)

        return {
            procedure: finalProcedure,
            path: methodName,
        }
    }

    private getProcedureMetadata(target: object, methodName: string): ProcedureDecoratorMetadata | null {
        return (Reflect.getMetadata(TRPC_PROCEDURE_METADATA, target, methodName) as ProcedureDecoratorMetadata) || null
    }

    private applyMiddleware(target: object, methodName: string, instance: ClassInstance, procedureBuilder: AnyProcedureBuilder): AnyProcedureBuilder {
        const middlewareMetadata = Reflect.getMetadata(TRPC_MIDDLEWARE_METADATA, target, methodName) as MiddlewareDecoratorMetadata | undefined
        let procedure = procedureBuilder

        if (middlewareMetadata?.middlewares?.length) {
            for (const middleware of middlewareMetadata.middlewares) {
                if (typeof middleware === 'string') {
                    const middlewareMethod = instance[middleware]
                    if (typeof middlewareMethod === 'function') {
                        const middlewareFn = middlewareMethod as InstanceMethod
                        procedure = procedure.use(async (opts) => {
                            await middlewareFn.call(instance, opts)
                            return opts.next()
                        })
                    }
                } else if (typeof middleware === 'function') {
                    procedure = procedure.use(middleware)
                }
            }
        }

        return procedure
    }

    private configureInputOutput(procedure: AnyProcedureBuilder, procedureMetadata: ProcedureDecoratorMetadata): AnyProcedureBuilder {
        let configuredProcedure = procedure

        if (procedureMetadata.input) {
            if (procedureMetadata.inputName) {
                const inputWithName = procedureMetadata.input.describe(procedureMetadata.inputName)
                configuredProcedure = configuredProcedure.input(inputWithName)
            } else {
                configuredProcedure = configuredProcedure.input(procedureMetadata.input)
            }
        }

        if (procedureMetadata.output && procedureMetadata.type !== 'subscription') {
            if (procedureMetadata.outputName) {
                const outputWithName = procedureMetadata.output.describe(procedureMetadata.outputName)
                configuredProcedure = configuredProcedure.output(outputWithName)
            } else {
                configuredProcedure = configuredProcedure.output(procedureMetadata.output)
            }
        }

        return configuredProcedure
    }

    private createProcedureHandler(target: object, methodName: string, instance: ClassInstance): ProcedureHandler {
        const parameterMetadata = this.getParameterMetadata(target, methodName)

        return async (opts: { input: unknown; ctx: unknown }) => {
            const { input, ctx } = opts
            const args = this.buildMethodArguments(input, ctx, parameterMetadata)

            const method = instance[methodName] as InstanceMethod
            return await method.apply(instance, args)
        }
    }

    private getParameterMetadata(
        target: object,
        methodName: string
    ): {
        inputParamIndexes: number[]
        contextParamIndexes: number[]
    } {
        const inputParamIndexes = (Reflect.getMetadata(TRPC_INPUT_PARAM_METADATA, target, methodName) as number[]) || []
        const contextParamIndexes = (Reflect.getMetadata(TRPC_CONTEXT_PARAM_METADATA, target, methodName) as number[]) || []

        return { inputParamIndexes, contextParamIndexes }
    }

    private buildMethodArguments(
        input: unknown,
        ctx: unknown,
        parameterMetadata: { inputParamIndexes: number[]; contextParamIndexes: number[] }
    ): unknown[] {
        const { inputParamIndexes, contextParamIndexes } = parameterMetadata
        const inputData = input || {}
        const contextData = ctx || input

        // If no parameter decorators are used, maintain backward compatibility
        if (inputParamIndexes.length === 0 && contextParamIndexes.length === 0) {
            return [inputData]
        }

        // Build arguments array based on parameter decorators
        const methodArgs: unknown[] = []

        for (const paramIndex of inputParamIndexes) {
            methodArgs[paramIndex] = inputData
        }

        for (const paramIndex of contextParamIndexes) {
            methodArgs[paramIndex] = contextData
        }

        return methodArgs
    }

    private createFinalProcedure(
        procedure: AnyProcedureBuilder,
        handler: ProcedureHandler,
        procedureMetadata: ProcedureDecoratorMetadata
    ): AnyTRPCProcedure {
        const { type } = procedureMetadata
        let finalProcedure: AnyTRPCProcedure

        switch (type) {
            case 'query':
                finalProcedure = procedure.query(handler) as AnyTRPCProcedure
                break
            case 'mutation':
                finalProcedure = procedure.mutation(handler) as AnyTRPCProcedure
                break
            case 'subscription':
                finalProcedure = procedure.subscription(handler) as AnyTRPCProcedure
                break
            default:
                throw ErrorHandler.createError('TRPCFactory', `Unknown procedure type: ${String(type)}`)
        }

        // Attach decorator metadata for schema generation
        if (procedureMetadata.output || procedureMetadata.outputName) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            ;(finalProcedure._def as any).output = procedureMetadata.output
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            ;(finalProcedure._def as any).outputName = procedureMetadata.outputName
        }

        return finalProcedure
    }
}
