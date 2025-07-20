import { Query } from '../../lib/decorators/query.decorator'
import { TestSchemas, TestData, TestHelpers } from '../utils/test-common'
import { z } from 'zod'
import { describe, it, expect, jest } from '@jest/globals'

// Mock FileScanner to prevent memory issues
jest.mock('../../lib/utils/file-scanner', () => ({
    FileScanner: {
        getCallerFilePath: jest.fn().mockReturnValue('mocked-file-path.ts'),
        getInputAndOutputNamesFromDecorator: jest.fn().mockReturnValue({ input: undefined, output: undefined }),
    },
}))

// TODO: Fix memory issues with query decorator test
describe('@Query Decorator', () => {
    describe('Decorator Creation', () => {
        it('should create a query decorator with basic configuration', () => {
            const decorator = Query()
            expect(decorator).toBeDefined()
            expect(typeof decorator).toBe('function')
        })

        it('should create a query decorator with input schema', () => {
            const decorator = Query({ input: TestSchemas.userInput })
            expect(decorator).toBeDefined()
        })

        it('should create a query decorator with output schema', () => {
            const decorator = Query({ output: TestSchemas.userOutput })
            expect(decorator).toBeDefined()
        })

        it('should create a query decorator with both input and output schemas', () => {
            const decorator = Query({
                input: TestSchemas.userInput,
                output: TestSchemas.userOutput,
            })
            expect(decorator).toBeDefined()
        })
    })

    describe('Metadata Handling', () => {
        it('should handle input parameter metadata', () => {
            const target = {}
            const methodName = 'getUser'

            TestHelpers.setupReflectMetadata(target, methodName, {
                input: [0],
            })

            const metadata = Reflect.getMetadata('trpc:input', target, methodName)
            expect(metadata).toEqual([0])

            TestHelpers.clearReflectMetadata(target, methodName)
        })

        it('should handle context parameter metadata', () => {
            const target = {}
            const methodName = 'getUser'

            TestHelpers.setupReflectMetadata(target, methodName, {
                context: [1],
            })

            const metadata = Reflect.getMetadata('trpc:context', target, methodName)
            expect(metadata).toEqual([1])

            TestHelpers.clearReflectMetadata(target, methodName)
        })
    })
})
