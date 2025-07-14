import 'reflect-metadata'
import { TRPC_CONTEXT_PARAM_METADATA } from '../constants'
import { createParameterDecorator } from './parameter.decorator'

export interface TrpcContextOptions {
    isOptional?: boolean
}

export const Context = createParameterDecorator(TRPC_CONTEXT_PARAM_METADATA)
