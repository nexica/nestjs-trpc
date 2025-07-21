declare module 'trpc-panel' {
    import { AnyTRPCRouter } from '@trpc/server'

    interface TrpcPanelOptions {
        url: string
        transformer?: 'superjson'
    }

    export function renderTrpcPanel(router: AnyTRPCRouter, options: TrpcPanelOptions): string
}
