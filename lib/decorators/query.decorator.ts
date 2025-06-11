import 'reflect-metadata'
import { FileScanner } from '../utils/file-scanner'
import { z } from 'zod/v4'
import { TRPC_PROCEDURE_METADATA } from '../constants'
import { ProcedureDecoratorMetadata } from '../interfaces/decorators.interface'

type ZodTypeAny = z.ZodType

export interface QueryOptions {
    input?: ZodTypeAny
    output?: ZodTypeAny
}

export function Query(options: QueryOptions = {}): MethodDecorator {
    const path = FileScanner.getCallerFilePath()
    return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
        const metadata: ProcedureDecoratorMetadata = {
            target,
            methodName: key.toString(),
            type: 'query',
            path,
            input: options.input,
            output: options.output,
        }

        Reflect.defineMetadata(TRPC_PROCEDURE_METADATA, metadata, target.constructor, key)

        return descriptor
    }
}
