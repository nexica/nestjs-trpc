import 'reflect-metadata'

import { TRPC_CONTEXT_PARAM_METADATA } from '../constants'

export interface TrpcContextOptions {
    isOptional?: boolean
}

export function Context(): (target: object, propertyKey: string | symbol, parameterIndex: number) => void {
    return (target: object, propertyKey: string | symbol, parameterIndex: number): void => {
        const existingParameters: number[] = (Reflect.getMetadata(TRPC_CONTEXT_PARAM_METADATA, target.constructor, propertyKey) as number[]) || []
        existingParameters.push(parameterIndex)
        Reflect.defineMetadata(TRPC_CONTEXT_PARAM_METADATA, existingParameters, target.constructor, propertyKey)
    }
}
