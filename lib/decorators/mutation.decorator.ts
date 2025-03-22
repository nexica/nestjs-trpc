import 'reflect-metadata'
import { z } from 'zod'
import { TRPC_PROCEDURE_METADATA } from '../constants'
import { ProcedureDecoratorMetadata } from '../interfaces/decorators.interface'
import { FileScanner } from '../utils/file-scanner'

export interface MutationOptions {
    input?: z.ZodType<any>
    output?: z.ZodType<any>
}

export function Mutation(options: MutationOptions = {}): MethodDecorator {
    const path = FileScanner.getCallerFilePath()
    return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
        if (process.env.TRPC_SCHEMA_GENERATION === 'true') {
            const { input, output } = FileScanner.getInputAndOutputNamesFromDecorator(path, key.toString())
            if (options.input) {
                options.input._def.description = input
            }
            if (options.output) {
                options.output._def.description = output
            }
        }

        const metadata: ProcedureDecoratorMetadata = {
            target,
            methodName: key.toString(),
            type: 'mutation',
            path,
            input: options.input,
            output: options.output,
        }

        Reflect.defineMetadata(TRPC_PROCEDURE_METADATA, metadata, target.constructor, key)

        return descriptor
    }
}
