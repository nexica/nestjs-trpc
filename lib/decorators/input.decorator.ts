import 'reflect-metadata'

import { TRPC_INPUT_PARAM_METADATA } from '../constants'

export interface TrpcInputOptions {
    isOptional?: boolean
}

export function Input(): (target: object, propertyKey: string | symbol, parameterIndex: number) => void {
    return (target: object, propertyKey: string | symbol, parameterIndex: number): void => {
        const existingParameters: number[] = (Reflect.getMetadata(TRPC_INPUT_PARAM_METADATA, target.constructor, propertyKey) as number[]) || []
        existingParameters.push(parameterIndex)
        Reflect.defineMetadata(TRPC_INPUT_PARAM_METADATA, existingParameters, target.constructor, propertyKey)
    }
}
