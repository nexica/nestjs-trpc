import { Module, DynamicModule, OnModuleInit, Inject, Injectable, Optional } from '@nestjs/common'
import { TRPCModuleOptions } from './interfaces/options.interface'
import { DiscoveryModule } from '@golevelup/nestjs-discovery'
import { ModuleRef, HttpAdapterHost } from '@nestjs/core'
import { AnyTRPCRouter } from '@trpc/server'
import { TRPCFactory } from './factory/trpc.factory'
import { TRPCDriver } from './drivers/trpc.driver'
import { ExpressDriver } from './drivers/express.driver'
import { FastifyDriver } from './drivers/fastify.driver'
import { TRPCAppRouter } from './providers/app-router.provider'
import { ContextOptions } from './interfaces/context.interface'
import { RouterGenerator } from './generators/router-generator'
import { ErrorHandler } from './utils/error-handler'

export const TRPC_ROUTER = 'TRPC_ROUTER'
export const TRPC_MODULE_OPTIONS = 'TRPC_MODULE_OPTIONS'
export const TRPC_ROUTER_INITIALIZED = 'TRPC_ROUTER_INITIALIZED'

/**
 * Operation mode for tRPC module initialization
 */
enum OperationMode {
    NORMAL = 'normal',
    SCHEMA_GENERATION = 'schema_generation',
    WATCH_MODE = 'watch_mode',
}

@Injectable()
export class TRPCHandler {
    private routerInitialized = false
    private dummyRouter: AnyTRPCRouter = {} as AnyTRPCRouter

    constructor(
        @Inject(TRPC_MODULE_OPTIONS)
        @Optional()
        private readonly options: TRPCModuleOptions = {},
        private readonly appRouterHost: TRPCAppRouter
    ) {}

    markInitialized() {
        this.routerInitialized = true
        ErrorHandler.logInfo('TRPCHandler', 'tRPC router has been successfully initialized')
    }

    isInitialized(): boolean {
        return this.routerInitialized && !!this.appRouterHost.appRouter
    }

    getAppRouter(): AnyTRPCRouter {
        if (!this.appRouterHost.appRouter) {
            if (!this.routerInitialized) {
                return this.dummyRouter
            }
            ErrorHandler.logError('TRPCHandler', 'tRPC router not initialized. Make sure TRPCModule.onModuleInit completed successfully.')
            return this.dummyRouter
        }
        return this.appRouterHost.appRouter
    }
}

@Module({
    imports: [DiscoveryModule],
    providers: [TRPCFactory, ExpressDriver, FastifyDriver],
    exports: [TRPCFactory, ExpressDriver, FastifyDriver, DiscoveryModule],
})
export class TRPCProvidersModule {}

@Module({})
export class TRPCModule implements OnModuleInit {
    private static moduleOptions: TRPCModuleOptions = {}

    @Inject(TRPC_MODULE_OPTIONS)
    private readonly options!: TRPCModuleOptions

    @Inject(TRPCDriver)
    private readonly trpcDriver!: TRPCDriver

    @Inject(HttpAdapterHost)
    private readonly httpAdapterHost!: HttpAdapterHost

    @Inject(TRPCHandler)
    private readonly trpcHandler!: TRPCHandler

    @Inject(ModuleRef)
    private readonly moduleRef!: ModuleRef

    static forRoot<TAppContext extends ContextOptions>(options: TRPCModuleOptions<TAppContext> = {}): DynamicModule {
        const defaultOptions: TRPCModuleOptions = {
            outputPath: './../generated/server.ts',
            generateSchemas: true,
        }

        const mergedOptions = { ...defaultOptions, ...options }

        TRPCModule.moduleOptions = mergedOptions

        return {
            global: true,
            module: TRPCModule,
            imports: [TRPCProvidersModule],
            providers: [
                {
                    provide: TRPC_MODULE_OPTIONS,
                    useValue: mergedOptions,
                },
                TRPCHandler,
                TRPCDriver,
                TRPCAppRouter,
                RouterGenerator,
                {
                    provide: TRPC_ROUTER,
                    useFactory: (handler: TRPCHandler) => {
                        return new Proxy(
                            {},
                            {
                                get(_, prop) {
                                    const router = handler.getAppRouter()
                                    return router[prop as keyof typeof router]
                                },
                            }
                        )
                    },
                    inject: [TRPCHandler],
                },
            ],
            exports: [TRPC_ROUTER, TRPCHandler, TRPCAppRouter, RouterGenerator],
        }
    }

    /**
     * Determines the operation mode based on environment variables
     */
    private getOperationMode(): OperationMode {
        const isSchemaGeneration = process.env.TRPC_SCHEMA_GENERATION === 'true'
        const isWatchMode = process.env.TRPC_WATCH_MODE === 'true'
        const isLegacySchemaWatch = process.env.TRPC_SCHEMA_GENERATION_WATCH === 'true'

        if (isWatchMode || isLegacySchemaWatch) {
            return OperationMode.WATCH_MODE
        }

        if (isSchemaGeneration) {
            return OperationMode.SCHEMA_GENERATION
        }

        return OperationMode.NORMAL
    }

    /**
     * Handles schema generation process
     */
    private async handleSchemaGeneration(continueAfterGeneration: boolean): Promise<void> {
        ErrorHandler.logInfo('TRPCModule', 'Running in schema generation mode')

        await this.trpcDriver.initializeRouter(TRPCModule.moduleOptions)
        this.trpcHandler.markInitialized()

        const routerGenerator = this.moduleRef.get(RouterGenerator)
        if (!routerGenerator) {
            ErrorHandler.logWarning('TRPCModule', 'RouterGenerator not available')
            return
        }

        const outputPath = TRPCModule.moduleOptions.outputPath
        if (!outputPath) {
            ErrorHandler.logWarning('TRPCModule', 'No output path specified for schema generation')
            return
        }

        ErrorHandler.logInfo('TRPCModule', `Generating schema with output path: ${outputPath}`)

        const schemaOptions = { ...TRPCModule.moduleOptions, outputPath }
        routerGenerator.setOptions(schemaOptions)

        try {
            await routerGenerator.generate()
            ErrorHandler.logInfo('TRPCModule', 'Schema generated successfully')

            if (continueAfterGeneration) {
                ErrorHandler.logInfo('TRPCModule', 'Watch mode enabled - continuing to run for live schema updates')
            } else {
                process.exit(0)
            }
        } catch (error) {
            ErrorHandler.logError('TRPCModule', 'Error generating schema:', error)
            throw error
        }
    }

    /**
     * Validates and fixes router procedures
     */
    private validateAndFixRouter(): void {
        const appRouter = this.trpcHandler.getAppRouter()
        if (!appRouter?._def?.procedures) {
            return
        }

        const procedures = Object.values(appRouter._def.procedures as Record<string, unknown>)
        for (const proc of procedures) {
            const procedure = proc as {
                _def?: {
                    procedureType?: string
                    query?: unknown
                    mutation?: unknown
                }
            }

            if (procedure?._def && !procedure._def.procedureType) {
                if (procedure._def.query) {
                    procedure._def.procedureType = 'query'
                } else if (procedure._def.mutation) {
                    procedure._def.procedureType = 'mutation'
                }
            }
        }
    }

    /**
     * Initializes tRPC in normal mode
     */
    private async initializeNormalMode(): Promise<void> {
        if (!this.httpAdapterHost?.httpAdapter) {
            ErrorHandler.logWarning('TRPCModule', 'HTTP adapter not available - tRPC initialization skipped')
            return
        }

        const success = await this.trpcDriver.start(TRPCModule.moduleOptions)

        if (success) {
            this.trpcHandler.markInitialized()
            this.validateAndFixRouter()
            ErrorHandler.logInfo('TRPCModule', 'tRPC module successfully initialized')
        } else {
            ErrorHandler.logWarning('TRPCModule', 'tRPC initialization failed but application will continue')
        }
    }

    async onModuleInit() {
        try {
            ErrorHandler.logInfo('TRPCModule', 'Initializing tRPC module...')

            const operationMode = this.getOperationMode()

            switch (operationMode) {
                case OperationMode.SCHEMA_GENERATION:
                    await this.handleSchemaGeneration(false)
                    break

                case OperationMode.WATCH_MODE:
                    await this.handleSchemaGeneration(true)
                    await this.initializeNormalMode()
                    break

                case OperationMode.NORMAL:
                default:
                    await this.initializeNormalMode()
                    break
            }
        } catch (error) {
            ErrorHandler.logError('TRPCModule', 'Error initializing tRPC module:', error)
        }
    }
}
