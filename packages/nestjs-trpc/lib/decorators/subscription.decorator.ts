import 'reflect-metadata'
import { z } from 'zod/v4'
import { createProcedureDecorator } from './procedure.decorator'

type ZodTypeAny = z.ZodType

export interface SubscriptionOptions {
    input?: ZodTypeAny
    output: ZodTypeAny
}

export const Subscription = createProcedureDecorator('subscription')
