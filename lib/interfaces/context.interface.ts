import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'

export type ContextOptions = CreateExpressContextOptions | CreateFastifyContextOptions

export interface TRPCContext<TAppContext = Record<string, unknown>> {
    create(opts: ContextOptions): TAppContext | Promise<TAppContext>
}
