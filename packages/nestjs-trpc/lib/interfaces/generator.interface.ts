import { z } from 'zod/v4'

type ZodTypeAny = z.ZodType

export interface GeneratorOptions {
    outputPath: string
    context?: unknown
    includeTypes?: boolean
    includeComments?: boolean
}

export interface GeneratorContext {
    instance: unknown
    procedures: Record<string, ProcedureInfo>
}

export interface ProcedureInfo {
    name: string
    type: 'query' | 'mutation' | 'subscription'
    input?: ZodTypeAny
    output?: ZodTypeAny
    middlewares?: string[]
}
