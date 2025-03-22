import { GetRawInputFn, MiddlewareResult, Overwrite, ProcedureType, Simplify } from '@trpc/server/dist/unstable-core-do-not-import'

type MiddlewareFunction<TContext, TMeta, TContextOverridesIn, $ContextOverridesOut, TInputOut> = {
    (opts: {
        ctx: TContext
        type: ProcedureType
        path: string
        input: TInputOut
        getRawInput: GetRawInputFn
        meta: TMeta | undefined
        signal: AbortSignal | undefined
        next: {
            (): Promise<MiddlewareResult<TContextOverridesIn>>
            <$ContextOverride>(opts: { ctx?: $ContextOverride; input?: unknown }): Promise<MiddlewareResult<$ContextOverride>>
            (opts: { getRawInput: GetRawInputFn }): Promise<MiddlewareResult<TContextOverridesIn>>
        }
    }): Promise<MiddlewareResult<$ContextOverridesOut>>
    _type?: string | undefined
}

export type MiddlewareFn<TContext = Record<string, unknown>> = MiddlewareFunction<TContext, any, TContext, any, any>
