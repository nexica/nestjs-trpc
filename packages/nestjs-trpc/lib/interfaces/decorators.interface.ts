import { z } from 'zod/v4'
import { AnyMiddlewareFunction } from '@trpc/server/unstable-core-do-not-import'

type ZodTypeAny = z.ZodType

export interface RouterDecoratorMetadata {
    target: object
    path?: string
    alias?: string
}

export interface ProcedureDecoratorMetadata {
    target: object
    methodName: string
    type: 'query' | 'mutation' | 'subscription'
    path: string
    input?: ZodTypeAny
    output?: ZodTypeAny
    inputName?: string
    outputName?: string
}

export interface InputDecoratorMetadata {
    target: object
    methodName: string
    parameterIndex: number
    isOptional?: boolean
}

export interface OutputDecoratorMetadata {
    target: object
    methodName: string
    parameterIndex: number
}

export interface MiddlewareDecoratorMetadata {
    target: object
    methodName?: string
    middlewares: Array<AnyMiddlewareFunction>
}
