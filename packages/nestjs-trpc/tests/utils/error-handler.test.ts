import { ErrorHandler } from '../../lib/utils/error-handler'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

describe('ErrorHandler', () => {
    describe('logError', () => {
        it('should log error with context and message', () => {
            const spy = jest.spyOn(ErrorHandler['logger'], 'error').mockImplementation(() => {})

            ErrorHandler.logError('TestContext', 'Test error message')

            expect(spy).toHaveBeenCalledWith('TestContext: Test error message', 'undefined')
            spy.mockRestore()
        })

        it('should log error with Error object', () => {
            const error = new Error('Test error')
            const spy = jest.spyOn(ErrorHandler['logger'], 'error').mockImplementation(() => {})

            ErrorHandler.logError('TestContext', 'Test error message', error)

            expect(spy).toHaveBeenCalledWith('TestContext: Test error message', error.stack)
            spy.mockRestore()
        })

        it('should log error with non-Error object', () => {
            const error = 'String error'
            const spy = jest.spyOn(ErrorHandler['logger'], 'error').mockImplementation(() => {})

            ErrorHandler.logError('TestContext', 'Test error message', error)

            expect(spy).toHaveBeenCalledWith('TestContext: Test error message', 'String error')
            spy.mockRestore()
        })
    })

    describe('logWarning', () => {
        it('should log warning with context and message', () => {
            const spy = jest.spyOn(ErrorHandler['logger'], 'warn').mockImplementation(() => {})

            ErrorHandler.logWarning('TestContext', 'Test warning message')

            expect(spy).toHaveBeenCalledWith('TestContext: Test warning message')
            spy.mockRestore()
        })

        it('should log warning with details', () => {
            const details = { key: 'value' }
            const spy = jest.spyOn(ErrorHandler['logger'], 'warn').mockImplementation(() => {})

            ErrorHandler.logWarning('TestContext', 'Test warning message', details)

            expect(spy).toHaveBeenCalledWith('TestContext: Test warning message - {"key":"value"}')
            spy.mockRestore()
        })
    })

    describe('logInfo', () => {
        it('should log info message', () => {
            const spy = jest.spyOn(ErrorHandler['logger'], 'log').mockImplementation(() => {})

            ErrorHandler.logInfo('TestContext', 'Test info message')

            expect(spy).toHaveBeenCalledWith('TestContext: Test info message')
            spy.mockRestore()
        })
    })

    describe('createError', () => {
        it('should create error with context and message', () => {
            const error = ErrorHandler.createError('TestContext', 'Test error message')

            expect(error).toBeInstanceOf(Error)
            expect(error.message).toBe('TestContext: Test error message')
        })

        it('should create error with original error stack', () => {
            const originalError = new Error('Original error')
            const error = ErrorHandler.createError('TestContext', 'Test error message', originalError)

            expect(error).toBeInstanceOf(Error)
            expect(error.message).toBe('TestContext: Test error message')
            expect(error.stack).toBe(originalError.stack)
        })
    })
})
