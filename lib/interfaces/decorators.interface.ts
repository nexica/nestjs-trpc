import { z } from 'zod/v4'
import { AnyTRPCMiddlewareFunction } from '@trpc/server'

type ZodTypeAny = z.ZodType

export interface BaseDecoratorMetadata {
    target: any
    methodName?: string
}

export interface RouterDecoratorMetadata extends BaseDecoratorMetadata {
    path?: string
    alias?: string
}

export interface ProcedureDecoratorMetadata extends BaseDecoratorMetadata {
    type: 'query' | 'mutation'
    path?: string
    input?: ZodTypeAny
    output?: ZodTypeAny
    inputName?: string
    outputName?: string
}

export interface InputDecoratorMetadata extends BaseDecoratorMetadata {
    inputType: string | ZodTypeAny
    isOptional?: boolean
}

export interface MiddlewareDecoratorMetadata {
    target: object
    methodName?: string
    middlewares: Array<AnyTRPCMiddlewareFunction>
}
