import { DynamicModule, Module } from '@nestjs/common'
import { TrpcPanelController, TrpcPanelOptions } from './panel.controller'
import { TRPC_PANEL_OPTIONS } from './panel.constants'

@Module({})
export class TrpcPanelModule {
    static register(options: TrpcPanelOptions = {}): DynamicModule {
        return {
            module: TrpcPanelModule,
            controllers: [TrpcPanelController],
            providers: [
                {
                    provide: TRPC_PANEL_OPTIONS,
                    useValue: options,
                },
            ],
            exports: [],
        }
    }
}
