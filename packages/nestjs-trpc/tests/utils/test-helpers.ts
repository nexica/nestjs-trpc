import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { TRPCModule } from '../../lib/module'
import { TRPCModuleOptions } from '../../lib/interfaces'
import { jest } from '@jest/globals'

export class TestAppBuilder {
    private module: TestingModule | null = null
    private app: INestApplication | null = null

    async createTestApp(options: TRPCModuleOptions = {}): Promise<INestApplication> {
        this.module = await Test.createTestingModule({
            imports: [TRPCModule.forRoot(options)],
        }).compile()

        this.app = this.module.createNestApplication()
        await this.app.init()
        return this.app
    }

    async closeTestApp(): Promise<void> {
        if (this.app) {
            await this.app.close()
        }
        if (this.module) {
            await this.module.close()
        }
    }

    getModule(): TestingModule | null {
        return this.module
    }

    getApp(): INestApplication | null {
        return this.app
    }
}

export const createMockContext = (overrides: any = {}) => ({
    req: {
        headers: {},
        body: {},
        query: {},
        params: {},
    },
    res: {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
    },
    ...overrides,
})

export const createMockProcedure = () => ({
    query: jest.fn(),
    mutation: jest.fn(),
    subscription: jest.fn(),
    input: jest.fn(),
    output: jest.fn(),
    middleware: jest.fn(),
})

export const createMockRouter = () => ({
    procedure: createMockProcedure(),
    merge: jest.fn(),
    createCaller: jest.fn(),
})

export const createMockTRPC = () => ({
    router: jest.fn(() => createMockRouter()),
    procedure: createMockProcedure(),
    initTRPC: {
        context: jest.fn(),
        procedure: jest.fn(() => createMockProcedure()),
    },
})

export const waitForAsync = (ms: number = 100): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
