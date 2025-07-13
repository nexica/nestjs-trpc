import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws'

export type ContextOptions = CreateExpressContextOptions | CreateFastifyContextOptions | CreateWSSContextFnOptions

export interface TRPCContext<TAppContext = Record<string, unknown>> {
    create(opts: ContextOptions): TAppContext | Promise<TAppContext>
}
