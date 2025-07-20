import { Test, TestingModule } from '@nestjs/testing'
import { TRPCModule } from '../../lib/module'
import { TRPCModuleOptions } from '../../lib/interfaces'
import { TestConfigs } from '../utils/test-common'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

describe('TRPCModule', () => {
    describe('forRoot', () => {
        it('should create module with default options', () => {
            const module = TRPCModule.forRoot()
            expect(module).toBeDefined()
            expect(module.module).toBe(TRPCModule)
        })

        it('should create module with custom options', () => {
            const options: TRPCModuleOptions = {
                generateSchemas: false,
                outputPath: './test-output.ts',
                transformer: 'superjson',
            }

            const module = TRPCModule.forRoot(options)
            expect(module).toBeDefined()
        })

        it('should create module with Express driver', () => {
            const options: TRPCModuleOptions = {
                driver: 'express',
            }

            const module = TRPCModule.forRoot(options)
            expect(module).toBeDefined()
        })

        it('should create module with Fastify driver', () => {
            const options: TRPCModuleOptions = {
                driver: 'fastify',
            }

            const module = TRPCModule.forRoot(options)
            expect(module).toBeDefined()
        })

        it('should create module with WebSocket support', () => {
            const options: TRPCModuleOptions = {
                websocket: {
                    port: 3001,
                },
            }

            const module = TRPCModule.forRoot(options)
            expect(module).toBeDefined()
        })
    })

    describe('Module Initialization', () => {
        let module: TestingModule

        beforeEach(async () => {
            module = await Test.createTestingModule({
                imports: [TRPCModule.forRoot()],
            }).compile()
        })

        afterEach(async () => {
            await module.close()
        })

        it('should initialize module successfully', () => {
            expect(module).toBeDefined()
        })

        it('should provide TRPCModule', () => {
            const trpcModule = module.get(TRPCModule)
            expect(trpcModule).toBeDefined()
        })
    })

    describe('Environment Variables', () => {
        const originalEnv = process.env

        beforeEach(() => {
            jest.resetModules()
            process.env = { ...originalEnv }
        })

        afterEach(() => {
            process.env = originalEnv
        })

        it('should handle TRPC_SCHEMA_GENERATION environment variable', async () => {
            process.env.TRPC_SCHEMA_GENERATION = 'true'

            const module = await Test.createTestingModule({
                imports: [TRPCModule.forRoot()],
            }).compile()

            expect(module).toBeDefined()
            await module.close()
        })

        it('should handle TRPC_WATCH_MODE environment variable', async () => {
            process.env.TRPC_WATCH_MODE = 'true'

            const module = await Test.createTestingModule({
                imports: [TRPCModule.forRoot()],
            }).compile()

            expect(module).toBeDefined()
            await module.close()
        })
    })
})
