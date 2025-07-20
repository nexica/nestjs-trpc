import '@jest/globals'
import { jest, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import 'reflect-metadata'

// Global test setup
beforeAll(() => {
    // Setup any global test configuration
})

afterAll(() => {
    // Cleanup any global test configuration
})

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Mock NestJS Logger to reduce test noise
    const { Logger } = require('@nestjs/common')
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
})

afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
})
