import { Injectable } from '@nestjs/common'
import type { FastifyInstance } from 'fastify'
import { TRPCContext, TRPCModuleOptions, ContextOptions } from '../interfaces'
import type { AnyTRPCRouter } from '@trpc/server'
import * as trpcFastify from '@trpc/server/adapters/fastify'

@Injectable()
export class FastifyDriver {
    public async start(
        options: TRPCModuleOptions,
        app: FastifyInstance,
        appRouter: AnyTRPCRouter,
        contextInstance: TRPCContext | null
    ): Promise<void> {
        await app.register(trpcFastify.fastifyTRPCPlugin, {
            prefix: options.basePath ?? '/trpc',
            useWSS: options.websocket?.enabled !== false && !!options.websocket,
            trpcOptions: {
                router: appRouter,
                ...(options.context != null && contextInstance != null
                    ? {
                          createContext: (opts: ContextOptions) => contextInstance.create(opts),
                      }
                    : {}),
            },
            ...(options.websocket?.enabled !== false && options.websocket
                ? {
                      keepAlive: {
                          enabled: true,
                          pingMs: 30000,
                          pongWaitMs: 5000,
                      },
                  }
                : {}),
        })
    }
}
