import { All, Controller, Inject, OnModuleInit, Optional } from '@nestjs/common'
import { TRPCAppRouter } from '../providers/app-router.provider'
import { AnyTRPCRouter } from '@trpc/server'
import { renderTrpcPanel } from 'trpc-ui'
import { TRPC_PANEL_OPTIONS } from './panel.constants'

export interface TrpcPanelOptions {
    url?: string
    transformer?: 'superjson' | undefined
}

@Controller()
export class TrpcPanelController implements OnModuleInit {
    private appRouter: AnyTRPCRouter | null = null

    constructor(
        @Inject(TRPCAppRouter) private readonly appRouterHost: TRPCAppRouter,
        @Optional() @Inject(TRPC_PANEL_OPTIONS) private readonly options?: TrpcPanelOptions
    ) {}

    onModuleInit() {
        this.appRouter = this.appRouterHost.appRouter
    }

    @All('/panel')
    panel(): string {
        if (!this.appRouter) {
            return 'tRPC router is not initialized yet. Please try again later.'
        }

        try {
            const html = renderTrpcPanel(this.appRouter, {
                url: this.options?.url || `http://localhost:${process.env.API_PORT || 3000}/trpc`,
                transformer: this.options?.transformer,
            })
            return html
        } catch (error) {
            console.error('Failed to render tRPC panel:', error)
            return 'Failed to render tRPC panel. See server logs for details.'
        }
    }
}
