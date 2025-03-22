import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'

export type ContextOptions = CreateExpressContextOptions

export interface TRPCContext<TAppContext = Record<string, unknown>> {
    create(opts: ContextOptions): TAppContext | Promise<TAppContext>
}
