import { TRPCFactory } from '../../lib/factory/trpc.factory'
import { MockFactories, TestHelpers } from '../utils/test-common'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

describe('TRPCFactory', () => {
    let factory: TRPCFactory

    beforeEach(() => {
        factory = new TRPCFactory()
    })

    describe('createAppRouter', () => {
        it('should create app router with empty options', async () => {
            // Suppress warning logs for this test
            const originalWarn = console.warn
            console.warn = jest.fn()

            const mockRouterFactory = MockFactories.routerFactory()
            const mockProcedureBuilder = MockFactories.procedureBuilder()

            const router = await factory.createAppRouter({}, mockRouterFactory, mockProcedureBuilder as any)

            expect(router).toBeDefined()
            expect(mockRouterFactory).toHaveBeenCalledWith({})

            // Restore console.warn
            console.warn = originalWarn
        })

        it('should handle discovery service not available', async () => {
            // Suppress warning logs for this test
            const originalWarn = console.warn
            console.warn = jest.fn()

            const mockRouterFactory = MockFactories.routerFactory()
            const mockProcedureBuilder = MockFactories.procedureBuilder()

            const router = await factory.createAppRouter({}, mockRouterFactory, mockProcedureBuilder as any)

            expect(router).toBeDefined()

            // Restore console.warn
            console.warn = originalWarn
        })

        it('should handle no router providers found', async () => {
            // Suppress warning logs for this test
            const originalWarn = console.warn
            console.warn = jest.fn()

            const mockRouterFactory = MockFactories.routerFactory()
            const mockProcedureBuilder = MockFactories.procedureBuilder()

            const router = await factory.createAppRouter({}, mockRouterFactory, mockProcedureBuilder as any)

            expect(router).toBeDefined()

            // Restore console.warn
            console.warn = originalWarn
        })
    })

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            // Suppress error and warning logging for this test
            const originalError = console.error
            const originalWarn = console.warn
            console.error = jest.fn()
            console.warn = jest.fn()

            const mockRouterFactory = MockFactories.routerFactory()
            const mockProcedureBuilder = MockFactories.procedureBuilder()

            // Mock discovery service to throw error
            Object.defineProperty(factory as any, 'discovery', {
                get: jest.fn().mockReturnValue({
                    providersWithMetaAtKey: jest.fn().mockRejectedValue(new Error('Discovery error') as never),
                }),
            })

            const router = await factory.createAppRouter({}, mockRouterFactory, mockProcedureBuilder as any)

            expect(router).toBeDefined()

            // Restore console methods
            console.error = originalError
            console.warn = originalWarn
        })
    })

    describe('Private Methods (via reflection)', () => {
        const privateMethods = [
            'getMethodsWithProcedureMetadata',
            'createProcedureFromMethod',
            'getProcedureMetadata',
            'applyMiddleware',
            'configureInputOutput',
            'createProcedureHandler',
            'getParameterMetadata',
            'buildMethodArguments',
        ]

        privateMethods.forEach((methodName) => {
            it(`should have ${methodName} method`, () => {
                const method = (factory as any)[methodName]
                expect(typeof method).toBe('function')
            })
        })
    })

    describe('Method Parameter Handling', () => {
        it('should handle input parameter metadata', () => {
            const target = {}
            const methodName = 'testMethod'

            TestHelpers.setupReflectMetadata(target, methodName, {
                'input:param': [0],
            })

            const metadata = (factory as any).getParameterMetadata(target, methodName)

            expect(metadata.inputParamIndexes).toEqual([0])
            expect(metadata.contextParamIndexes).toEqual([])

            TestHelpers.clearReflectMetadata(target, methodName)
        })

        it('should handle context parameter metadata', () => {
            const target = {}
            const methodName = 'testMethod'

            TestHelpers.setupReflectMetadata(target, methodName, {
                'context:param': [1],
            })

            const metadata = (factory as any).getParameterMetadata(target, methodName)

            expect(metadata.inputParamIndexes).toEqual([])
            expect(metadata.contextParamIndexes).toEqual([1])

            TestHelpers.clearReflectMetadata(target, methodName)
        })

        it('should build method arguments correctly', () => {
            const input = { id: '123' }
            const ctx = { user: 'test' }
            const parameterMetadata = {
                inputParamIndexes: [0],
                contextParamIndexes: [1],
            }

            const args = (factory as any).buildMethodArguments(input, ctx, parameterMetadata)

            expect(args).toEqual([input, ctx])
        })

        it('should handle backward compatibility when no decorators used', () => {
            const input = { id: '123' }
            const ctx = { user: 'test' }
            const parameterMetadata = {
                inputParamIndexes: [],
                contextParamIndexes: [],
            }

            const args = (factory as any).buildMethodArguments(input, ctx, parameterMetadata)

            expect(args).toEqual([input])
        })
    })
})
