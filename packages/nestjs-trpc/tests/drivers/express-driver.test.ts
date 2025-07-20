import { ExpressDriver } from '../../lib/drivers/express.driver'
import { MockFactories, TestConfigs } from '../utils/test-common'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock express module
jest.mock('express', () => ({
    __esModule: true,
    default: jest.fn(() => MockFactories.expressApp()),
}))

describe('ExpressDriver', () => {
    let driver: ExpressDriver

    beforeEach(() => {
        driver = new ExpressDriver()
        jest.clearAllMocks()
    })

    afterEach(() => {
        // Ensure proper cleanup
        driver.shutdown()
    })

    describe('initialization', () => {
        it('should create ExpressDriver instance', () => {
            expect(driver).toBeDefined()
            expect(driver).toBeInstanceOf(ExpressDriver)
        })

        it('should have required methods', () => {
            expect(typeof driver.start).toBe('function')
            expect(typeof driver.shutdown).toBe('function')
            expect(typeof driver.getWebSocketHandler).toBe('function')
        })
    })

    describe('start method', () => {
        it('should handle start with basic options', () => {
            const mockApp = MockFactories.expressApp()
            const mockRouter = MockFactories.trpcRouter()
            const mockContext = null

            const result = driver.start(TestConfigs.basicTRPCOptions, mockApp as any, mockRouter as any, mockContext)

            expect(result).toBeDefined()
        })

        it('should handle start with WebSocket options', () => {
            const mockApp = MockFactories.expressApp()
            const mockRouter = MockFactories.trpcRouter()
            const mockContext = null

            const result = driver.start(TestConfigs.websocketTRPCOptions, mockApp as any, mockRouter as any, mockContext)

            expect(result).toBeDefined()
        })

        it('should handle start with context', () => {
            const mockApp = MockFactories.expressApp()
            const mockRouter = MockFactories.trpcRouter()
            const mockContext = MockFactories.context()

            const result = driver.start(TestConfigs.contextTRPCOptions, mockApp as any, mockRouter as any, mockContext)

            expect(result).toBeDefined()
        })
    })

    describe('shutdown method', () => {
        it('should handle shutdown gracefully', () => {
            expect(() => {
                driver.shutdown()
            }).not.toThrow()
        })
    })

    describe('getWebSocketHandler method', () => {
        it('should return null when no WebSocket handler is set', () => {
            const handler = driver.getWebSocketHandler()
            expect(handler).toBeNull()
        })
    })

    describe('error handling', () => {
        it('should handle start errors gracefully', () => {
            // Suppress error logging for this test
            const originalError = console.error
            console.error = jest.fn()

            const mockApp = {
                ...MockFactories.expressApp(),
                use: jest.fn().mockImplementation(() => {
                    throw new Error('Start failed')
                }),
            }
            const mockRouter = MockFactories.trpcRouter()
            const mockContext = null

            const result = driver.start(TestConfigs.basicTRPCOptions, mockApp as any, mockRouter as any, mockContext)

            expect(result).toBe(false)

            // Restore console.error
            console.error = originalError
        })
    })
})
