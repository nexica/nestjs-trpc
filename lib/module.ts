import { Module, DynamicModule, OnModuleInit, Inject, Injectable, Optional, Logger } from '@nestjs/common'
import { TRPCModuleOptions } from './interfaces/options.interface'
import { DiscoveryModule } from '@golevelup/nestjs-discovery'
import { ModuleRef, HttpAdapterHost } from '@nestjs/core'
import { AnyTRPCRouter } from '@trpc/server'
import { TRPCFactory } from './factory/trpc.factory'
import { TRPCDriver } from './drivers/trpc.driver'
import { ExpressDriver } from './drivers/express.driver'
import { TRPCAppRouter } from './providers/app-router.provider'
import { SchemaGenerator } from './generators/schema-generator'
import { ContextOptions } from './interfaces/context.interface'

export const TRPC_ROUTER = 'TRPC_ROUTER'
export const TRPC_MODULE_OPTIONS = 'TRPC_MODULE_OPTIONS'
export const TRPC_ROUTER_INITIALIZED = 'TRPC_ROUTER_INITIALIZED'

@Injectable()
export class TRPCHandler {
    private readonly logger = new Logger(TRPCHandler.name)
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
        this.logger.log('tRPC router has been successfully initialized')
    }

    isInitialized(): boolean {
        return this.routerInitialized && !!this.appRouterHost.appRouter
    }

    getAppRouter(): AnyTRPCRouter {
        if (!this.appRouterHost.appRouter) {
            if (!this.routerInitialized) {
                return this.dummyRouter
            }
            this.logger.error('tRPC router not initialized. Make sure TRPCModule.onModuleInit completed successfully.')
            return this.dummyRouter
        }
        return this.appRouterHost.appRouter
    }
}

@Module({
    imports: [DiscoveryModule],
    providers: [TRPCFactory, ExpressDriver],
    exports: [TRPCFactory, ExpressDriver, DiscoveryModule],
})
export class TRPCProvidersModule {}

@Module({})
export class TRPCModule implements OnModuleInit {
    private static moduleOptions: TRPCModuleOptions = {}
    private readonly logger = new Logger(TRPCModule.name)

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
        TRPCModule.moduleOptions = options

        return {
            global: true,
            module: TRPCModule,
            imports: [TRPCProvidersModule],
            providers: [
                {
                    provide: TRPC_MODULE_OPTIONS,
                    useValue: options,
                },
                TRPCHandler,
                TRPCDriver,
                TRPCAppRouter,
                SchemaGenerator,
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
            exports: [TRPC_ROUTER, TRPCHandler, TRPCAppRouter, SchemaGenerator],
        }
    }

    async onModuleInit() {
        try {
            this.logger.log('Initializing tRPC module...')

            const isSchemaGenerationMode = process.env.TRPC_SCHEMA_GENERATION === 'true'
            if (isSchemaGenerationMode) {
                this.logger.log('Running in schema generation mode')

                await this.trpcDriver.initializeRouter(TRPCModule.moduleOptions)
                this.trpcHandler.markInitialized()

                this.logger.log('Generating schema from the initialized router')
                try {
                    const schemaGenerator = this.moduleRef.get(SchemaGenerator)
                    if (schemaGenerator) {
                        const outputPath = TRPCModule.moduleOptions.outputPath
                        if (outputPath) {
                            this.logger.log(`Using output path: ${outputPath}`)

                            const schemaOptions = { ...TRPCModule.moduleOptions }
                            if (outputPath) {
                                schemaOptions.outputPath = outputPath
                            }

                            schemaGenerator.setOptions(schemaOptions)
                            await schemaGenerator.generate()
                            this.logger.log('Schema generated successfully')
                            process.exit(0)
                        } else {
                            this.logger.warn('No output path specified for schema generation')
                        }
                    } else {
                        this.logger.warn('SchemaGenerator not available')
                    }
                } catch (error) {
                    this.logger.error('Error generating schema:', error)
                }

                return
            }

            if (!this.httpAdapterHost?.httpAdapter) {
                this.logger.warn('HTTP adapter not available - tRPC initialization skipped')
                return
            }

            const success = await this.trpcDriver.start(TRPCModule.moduleOptions)

            if (success) {
                this.trpcHandler.markInitialized()
                if (this.trpcHandler.getAppRouter()) {
                    const appRouter = this.trpcHandler.getAppRouter()
                    if (appRouter && appRouter._def && appRouter._def.procedures) {
                        const procedures = Object.values(appRouter._def.procedures as Record<string, unknown>)
                        for (const proc of procedures) {
                            const procedure = proc as { _def?: { procedureType?: string; query?: unknown; mutation?: unknown } }
                            if (procedure && procedure._def && !procedure._def.procedureType) {
                                if (procedure._def.query) {
                                    procedure._def.procedureType = 'query'
                                } else if (procedure._def.mutation) {
                                    procedure._def.procedureType = 'mutation'
                                }
                            }
                        }
                    }
                }
                this.logger.log('tRPC module successfully initialized')
            } else {
                this.logger.warn('tRPC initialization failed but application will continue')
            }
        } catch (error) {
            this.logger.error('Error initializing tRPC module:', error)
            // Don't re-throw to allow the application to start anyway
            // This prevents initialization issues from crashing the whole application
        }
    }
}
