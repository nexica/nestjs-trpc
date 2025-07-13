import 'reflect-metadata'
import { TRPC_INPUT_PARAM_METADATA } from '../constants'
import { createParameterDecorator } from './parameter.decorator'

export interface TrpcInputOptions {
    isOptional?: boolean
}

export const Input = createParameterDecorator(TRPC_INPUT_PARAM_METADATA)
