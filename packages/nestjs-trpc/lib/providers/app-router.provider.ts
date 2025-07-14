import { Injectable } from '@nestjs/common'
import { AnyTRPCRouter } from '@trpc/server'

@Injectable()
export class TRPCAppRouter {
    appRouter: AnyTRPCRouter | null = null
}
