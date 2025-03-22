import { Injectable, Logger } from '@nestjs/common'
import type { Application as ExpressApplication, RequestHandler } from 'express'
import { TRPCContext, TRPCModuleOptions } from '../interfaces'
import type { AnyTRPCRouter } from '@trpc/server'
import * as trpcExpress from '@trpc/server/adapters/express'

@Injectable()
export class ExpressDriver {
    private readonly logger = new Logger(ExpressDriver.name)

    public start(options: TRPCModuleOptions, app: ExpressApplication, appRouter: AnyTRPCRouter, contextInstance: TRPCContext | null): boolean {
        try {
            const basePath = options.basePath ?? '/trpc'

            this.logger.log(`Mounting tRPC at path: ${basePath}`)

            const middleware = trpcExpress.createExpressMiddleware({
                router: appRouter,
                ...(options.context != null && contextInstance != null
                    ? {
                          createContext: (opts) => contextInstance.create(opts),
                      }
                    : {}),
            }) as RequestHandler

            app.use(basePath, middleware)

            this.logger.log('tRPC Express middleware installed successfully')
            return true
        } catch (error) {
            this.logger.error('Failed to initialize tRPC Express middleware:', error)
            return false
        }
    }
}
