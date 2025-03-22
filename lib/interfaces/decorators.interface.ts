import { z } from 'zod'
import { AnyTRPCMiddlewareFunction } from '@trpc/server'

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
    input?: z.ZodType<any>
    output?: z.ZodType<any>
}

export interface InputDecoratorMetadata extends BaseDecoratorMetadata {
    inputType: string | z.ZodType<any>
    isOptional?: boolean
}

export interface MiddlewareDecoratorMetadata {
    target: object
    methodName?: string
    middlewares: Array<AnyTRPCMiddlewareFunction>
}
