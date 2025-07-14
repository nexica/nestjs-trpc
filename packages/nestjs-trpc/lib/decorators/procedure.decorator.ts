import 'reflect-metadata'
import { FileScanner } from '../utils/file-scanner'
import { z } from 'zod/v4'
import { TRPC_PROCEDURE_METADATA } from '../constants'
import { ProcedureDecoratorMetadata } from '../interfaces/decorators.interface'

type ZodTypeAny = z.ZodType

export interface ProcedureOptions {
    input?: ZodTypeAny
    output?: ZodTypeAny
}

export type ProcedureType = 'query' | 'mutation' | 'subscription'

export function createProcedureDecorator(type: ProcedureType) {
    return function (options: ProcedureOptions = {}): MethodDecorator {
        const path = FileScanner.getCallerFilePath()
        return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
            let inputName: string | undefined = undefined
            let outputName: string | undefined = undefined

            if (process.env.TRPC_SCHEMA_GENERATION === 'true') {
                const { input, output } = FileScanner.getInputAndOutputNamesFromDecorator(path, key.toString())
                inputName = input
                outputName = output
            }

            const metadata: ProcedureDecoratorMetadata = {
                target,
                methodName: key.toString(),
                type,
                path,
                input: options.input,
                output: options.output,
                inputName,
                outputName,
            }

            Reflect.defineMetadata(TRPC_PROCEDURE_METADATA, metadata, target.constructor, key)

            return descriptor
        }
    }
}
