import { Injectable, Logger } from '@nestjs/common'
import type { Application as ExpressApplication, RequestHandler } from 'express'
import { TRPCContext, TRPCModuleOptions } from '../interfaces'
import type { AnyTRPCRouter } from '@trpc/server'
import * as trpcExpress from '@trpc/server/adapters/express'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'

@Injectable()
export class ExpressDriver {
    private readonly logger = new Logger(ExpressDriver.name)
    private wssHandler: ReturnType<typeof applyWSSHandler> | null = null

    public start(options: TRPCModuleOptions, app: ExpressApplication, appRouter: AnyTRPCRouter, contextInstance: TRPCContext | null): boolean {
        try {
            const basePath = options.basePath ?? '/trpc'

            this.logger.log(`Mounting tRPC at path: ${basePath}`)

            // Set up HTTP middleware
            const middleware = trpcExpress.createExpressMiddleware({
                router: appRouter,
                ...(options.context != null && contextInstance != null
                    ? {
                          createContext: (opts) => contextInstance.create(opts),
                      }
                    : {}),
            }) as RequestHandler

            app.use(basePath, middleware)

            // Set up WebSocket handler for subscriptions
            this.setupWebSocketHandler(options, appRouter, contextInstance)

            this.logger.log('tRPC Express middleware installed successfully')
            return true
        } catch (error) {
            this.logger.error('Failed to initialize tRPC Express middleware:', error)
            return false
        }
    }

    private setupWebSocketHandler(options: TRPCModuleOptions, appRouter: AnyTRPCRouter, contextInstance: TRPCContext | null): void {
        const websocketOptions = options.websocket

        // Skip WebSocket setup if disabled or no options provided
        if (!websocketOptions || websocketOptions.enabled === false) {
            this.logger.log('WebSocket subscriptions disabled - skipping WebSocket setup')
            return
        }

        try {
            let wss: WebSocketServer

            if (websocketOptions.wss) {
                // Use provided WebSocket server
                wss = websocketOptions.wss
                this.logger.log('Using provided WebSocket server for subscriptions')
            } else if (websocketOptions.port) {
                // Create new WebSocket server on specified port
                wss = new WebSocketServer({
                    port: websocketOptions.port,
                    path: websocketOptions.path || '/trpc',
                })
                this.logger.log(`Created WebSocket server on port ${websocketOptions.port}`)
            } else {
                this.logger.warn('No WebSocket server configuration provided - subscriptions will not work')
                return
            }

            // Apply WebSocket handler
            this.wssHandler = applyWSSHandler({
                wss,
                router: appRouter,
                ...(options.context != null && contextInstance != null
                    ? {
                          createContext: (opts) => {
                              return contextInstance.create(opts)
                          },
                      }
                    : {}),
            })

            this.logger.log('WebSocket handler applied successfully - subscriptions are now supported')

            // Handle WebSocket server events
            wss.on('connection', (ws) => {
                this.logger.debug('New WebSocket connection established')
                ws.on('close', () => {
                    this.logger.debug('WebSocket connection closed')
                })
                ws.on('error', (error: Error) => {
                    this.logger.error('WebSocket error:', error)
                })
            })

            wss.on('error', (error) => {
                this.logger.error('WebSocket server error:', error)
            })
        } catch (error) {
            this.logger.error('Failed to setup WebSocket handler:', error)
        }
    }

    public getWebSocketHandler(): ReturnType<typeof applyWSSHandler> | null {
        return this.wssHandler
    }

    public shutdown(): void {
        if (this.wssHandler) {
            try {
                // Close WebSocket connections
                this.wssHandler.broadcastReconnectNotification()
                this.logger.log('WebSocket handler shutdown completed')
            } catch (error) {
                this.logger.error('Error during WebSocket handler shutdown:', error)
            }
        }
    }
}
