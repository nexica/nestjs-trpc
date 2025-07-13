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

    public async initializeRouter(options: TRPCModuleOptions): Promise<boolean> {
        if (this.initialized) {
            this.logger.warn('tRPC driver already initialized')
            return true
        }

        const t = initTRPC.context().create({
            ...(options.transformer != null ? { transformer: options.transformer } : {}),
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

        const t = initTRPC.context().create({
            ...(options.transformer != null ? { transformer: options.transformer } : {}),
        })

        try {
            if (!this.httpAdapterHost?.httpAdapter) {
                this.logger.warn('HttpAdapterHost not available, skipping tRPC initialization')
                return false
            }

            const appRouter: AnyTRPCRouter = await this.trpcFactory.createAppRouter(options, t.router, t.procedure)

            this.trpcAppRouter.appRouter = appRouter

            let contextInstance = null
            const contextClass = options.context

            if (contextClass) {
                try {
                    contextInstance = this.moduleRef.get<Type<TRPCContext>, TRPCContext>(contextClass, {
                        strict: false,
                    })
                } catch (error) {
                    this.logger.warn('Failed to get context from ModuleRef:', error)
                }
            }

            const { httpAdapter } = this.httpAdapterHost
            const platformName = httpAdapter.getType()
            this.logger.log(`Detected platform: ${platformName}`)

            // Determine which driver to use based on options or platform detection
            const driverToUse: 'express' | 'fastify' = options.driver || (platformName === 'fastify' ? 'fastify' : 'express')
            this.logger.log(`Using driver: ${driverToUse}`)

            if (driverToUse === 'express') {
                try {
                    const app = httpAdapter.getInstance<ExpressApplication>()
                    const success = this.expressDriver.start(options, app, appRouter, contextInstance)
                    if (success) {
                        this.initialized = true
                        Object.keys(appRouter._def.procedures as Record<string, unknown>).forEach((procedure) => {
                            this.logger.log(`Registered procedure: ${procedure}`)
                        })
                        this.logger.log('tRPC initialization successful, router is now available')
                        return true
                    } else {
                        this.logger.error('Express driver failed to initialize')
                        return false
                    }
                } catch (err) {
                    this.logger.error('Failed to initialize Express driver:', err instanceof Error ? err.message : String(err))
                    return false
                }
            } else if (driverToUse === 'fastify') {
                try {
                    const app = httpAdapter.getInstance<FastifyInstance>()
                    await this.fastifyDriver.start(options, app, appRouter, contextInstance)
                    this.initialized = true
                    Object.keys(appRouter._def.procedures as Record<string, unknown>).forEach((procedure) => {
                        this.logger.log(`Registered procedure: ${procedure}`)
                    })
                    this.logger.log('tRPC initialization successful, router is now available')
                    return true
                } catch (err) {
                    this.logger.error('Failed to initialize Fastify driver:', err instanceof Error ? err.message : String(err))
                    return false
                }
            } else {
                this.logger.warn(`Unsupported driver: ${String(driverToUse)}`)
                return false
            }
        } catch (error) {
            this.logger.error('Error starting TRPC driver:', error)
            return false
        }
    }
}
