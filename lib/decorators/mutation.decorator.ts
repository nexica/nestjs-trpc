import 'reflect-metadata'
import { z } from 'zod/v4'
import { createProcedureDecorator, ProcedureOptions } from './procedure.decorator'

type ZodTypeAny = z.ZodType

export interface MutationOptions extends ProcedureOptions {
    input?: ZodTypeAny
    output?: ZodTypeAny
}

export const Mutation = createProcedureDecorator('mutation')
