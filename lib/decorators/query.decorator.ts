import 'reflect-metadata'
import { z } from 'zod/v4'
import { createProcedureDecorator, ProcedureOptions } from './procedure.decorator'

type ZodTypeAny = z.ZodType

export interface QueryOptions extends ProcedureOptions {
    input?: ZodTypeAny
    output?: ZodTypeAny
}

export const Query = createProcedureDecorator('query')
