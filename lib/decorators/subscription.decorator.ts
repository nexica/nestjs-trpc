import 'reflect-metadata'
import { z } from 'zod/v4'
import { TRPC_PROCEDURE_METADATA } from '../constants'
import { ProcedureDecoratorMetadata } from '../interfaces/decorators.interface'
import { FileScanner } from '../utils/file-scanner'

type ZodTypeAny = z.ZodType

export interface SubscriptionOptions {
    input?: ZodTypeAny
    output?: ZodTypeAny
}

export function Subscription(options: SubscriptionOptions = {}): MethodDecorator {
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
            type: 'subscription',
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
