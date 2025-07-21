import { Injectable, Type, Inject, Logger } from '@nestjs/common'
import { HttpAdapterHost, ModuleRef } from '@nestjs/core'
import { AnyTRPCRouter, initTRPC } from '@trpc/server'
import { TRPCContext, TRPCModuleOptions } from '../interfaces'
import { TRPCFactory } from '../factory/trpc.factory'
import { ExpressDriver } from './express.driver'
import { FastifyDriver } from './fastify.driver'
import { TRPCAppRouter } from '../providers/app-router.provider'
import type { Application as ExpressApplication } from 'express'
import type { FastifyInstance } from 'fastify'
import { DataTransformerOptions } from '@trpc/server/dist/unstable-core-do-not-import.d-C6mFWtNG.cjs'

@Injectable()
export class TRPCDriver {
    private readonly logger = new Logger(TRPCDriver.name)

    @Inject(HttpAdapterHost)
    private readonly httpAdapterHost!: HttpAdapterHost

    @Inject(TRPCFactory)
    private readonly trpcFactory!: TRPCFactory

    @Inject(ExpressDriver)
    private readonly expressDriver!: ExpressDriver

    @Inject(FastifyDriver)
    private readonly fastifyDriver!: FastifyDriver

    @Inject(ModuleRef)
    private readonly moduleRef!: ModuleRef

    @Inject(TRPCAppRouter)
    private readonly trpcAppRouter!: TRPCAppRouter

    private initialized = false

    isInitialized(): boolean {
        return this.initialized
    }

    private async resolveTransformer(transformerOption?: 'superjson' | 'devalue'): Promise<DataTransformerOptions | undefined> {
        if (!transformerOption) return undefined

        try {
            switch (transformerOption) {
                case 'superjson': {
                    const superjsonModule = await import('superjson')
                    return superjsonModule.default || superjsonModule
                }
                case 'devalue': {
                    const devalueModule = await import('devalue')
                    return { serialize: devalueModule.stringify, deserialize: devalueModule.parse }
                }
                default:
                    this.logger.warn('Unknown transformer provided')
                    return undefined
            }
        } catch (error) {
            this.logger.error(`Failed to import transformer ${transformerOption}:`, error)
            return undefined
        }
    }

    public async initializeRouter(options: TRPCModuleOptions): Promise<boolean> {
        if (this.initialized) {
            this.logger.warn('tRPC driver already initialized')
            return true
        }

        const transformer = await this.resolveTransformer(options.transformer)
        const t = initTRPC.context().create({
            ...(transformer ? { transformer } : {}),
        })

        try {
            const appRouter: AnyTRPCRouter = await this.trpcFactory.createAppRouter(options, t.router, t.procedure)

            this.trpcAppRouter.appRouter = appRouter

            this.initialized = true
            this.logger.log('tRPC router initialized for schema generation')
            return true
        } catch (error) {
            this.logger.error('Error initializing router:', error)
            return false
        }
    }

    public async start(options: TRPCModuleOptions): Promise<boolean> {
        if (this.initialized) {
            this.logger.warn('tRPC driver already initialized')
            return true
        }

        if (!this.httpAdapterHost?.httpAdapter) {
            this.logger.warn('HttpAdapterHost not available, skipping tRPC initialization')
            return false
        }

        try {
            const appRouter = await this.createAppRouter(options)
            const contextInstance = this.getContextInstance(options)
            const driverType = this.determineDriverType(options)

            const success = await this.initializeDriver(driverType, options, appRouter, contextInstance)

            if (success) {
                this.initialized = true
                this.logRegisteredProcedures(appRouter)
                this.logger.log('tRPC initialization successful, router is now available')
            }

            return success
        } catch (error) {
            this.logger.error('Error starting TRPC driver:', error)
            return false
        }
    }

    private async createAppRouter(options: TRPCModuleOptions): Promise<AnyTRPCRouter> {
        const transformer = await this.resolveTransformer(options.transformer)
        const t = initTRPC.context().create({
            ...(transformer ? { transformer } : {}),
        })

        const appRouter = await this.trpcFactory.createAppRouter(options, t.router, t.procedure)
        this.trpcAppRouter.appRouter = appRouter
        return appRouter
    }

    private getContextInstance(options: TRPCModuleOptions): TRPCContext | null {
        if (!options.context) {
            return null
        }

        try {
            return this.moduleRef.get<Type<TRPCContext>, TRPCContext>(options.context, {
                strict: false,
            })
        } catch (error) {
            this.logger.warn('Failed to get context from ModuleRef:', error)
            return null
        }
    }

    private determineDriverType(options: TRPCModuleOptions): 'express' | 'fastify' {
        const { httpAdapter } = this.httpAdapterHost
        const platformName = httpAdapter.getType()

        this.logger.log('Detected platform: ' + platformName)

        const driverType = options.driver || (platformName === 'fastify' ? 'fastify' : 'express')
        this.logger.log('Using driver: ' + driverType)

        return driverType
    }

    private async initializeDriver(
        driverType: 'express' | 'fastify',
        options: TRPCModuleOptions,
        appRouter: AnyTRPCRouter,
        contextInstance: TRPCContext | null
    ): Promise<boolean> {
        const { httpAdapter } = this.httpAdapterHost

        if (driverType === 'express') {
            return this.initializeExpressDriver(options, httpAdapter, appRouter, contextInstance)
        } else if (driverType === 'fastify') {
            return this.initializeFastifyDriver(options, httpAdapter, appRouter, contextInstance)
        } else {
            this.logger.warn('Unsupported driver: ' + String(driverType))
            return false
        }
    }

    private initializeExpressDriver(
        options: TRPCModuleOptions,
        httpAdapter: any,
        appRouter: AnyTRPCRouter,
        contextInstance: TRPCContext | null
    ): boolean {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const app = httpAdapter.getInstance() as ExpressApplication
            const success = this.expressDriver.start(options, app, appRouter, contextInstance)

            if (!success) {
                this.logger.error('Express driver failed to initialize')
            }

            return success
        } catch (err) {
            this.logger.error('Failed to initialize Express driver:', err instanceof Error ? err.message : String(err))
            return false
        }
    }

    private async initializeFastifyDriver(
        options: TRPCModuleOptions,
        httpAdapter: any,
        appRouter: AnyTRPCRouter,
        contextInstance: TRPCContext | null
    ): Promise<boolean> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const app = httpAdapter.getInstance() as FastifyInstance
            await this.fastifyDriver.start(options, app, appRouter, contextInstance)
            return true
        } catch (err) {
            this.logger.error('Failed to initialize Fastify driver:', err instanceof Error ? err.message : String(err))
            return false
        }
    }

    private logRegisteredProcedures(appRouter: AnyTRPCRouter): void {
        Object.keys(appRouter._def.procedures as Record<string, unknown>).forEach((procedure) => {
            this.logger.log(`Registered procedure: ${procedure}`)
        })
    }
}
