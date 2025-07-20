import { z } from 'zod'
import { jest } from '@jest/globals'

// Common Zod schemas for testing
export const TestSchemas = {
    userInput: z.object({
        id: z.string(),
        name: z.string().optional(),
    }),

    userOutput: z.object({
        id: z.string(),
        name: z.string(),
        email: z.email({ message: 'Invalid email format' }),
    }),

    createUserInput: z.object({
        name: z.string(),
        email: z.email({ message: 'Invalid email format' }),
    }),
}

// Common mock factories
export const MockFactories = {
    routerFactory: () =>
        jest.fn(() => ({
            _def: {},
            createCaller: jest.fn(),
        })) as any,

    procedureBuilder: () => ({
        query: jest.fn(),
        mutation: jest.fn(),
        subscription: jest.fn(),
        input: jest.fn().mockReturnThis(),
        output: jest.fn().mockReturnThis(),
        use: jest.fn().mockReturnThis(),
    }),

    expressApp: () => ({
        use: jest.fn(),
        listen: jest.fn().mockReturnValue({
            close: jest.fn(),
        }),
    }),

    trpcRouter: () => ({
        _def: {
            _config: {
                transformer: {
                    input: jest.fn(),
                    output: jest.fn(),
                },
            },
        },
        createCaller: jest.fn(),
    }),

    context: () =>
        ({
            create: jest.fn().mockReturnValue(Promise.resolve({})) as any,
        }) as any,
}

// Common test data
export const TestData = {
    user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
    },

    users: [
        { id: '1', name: 'User 1', email: 'user1@example.com' },
        { id: '2', name: 'User 2', email: 'user2@example.com' },
    ],

    context: {
        user: { id: 'user-123', name: 'Context User' },
        requestId: 'req-456',
    },
}

// Common test helpers
export const TestHelpers = {
    createMockMetadata: (type: string, indexes: number[] = [0]) => {
        return { [type]: indexes }
    },

    setupReflectMetadata: (target: object, methodName: string, metadata: Record<string, any>) => {
        Object.entries(metadata).forEach(([key, value]) => {
            Reflect.defineMetadata(`trpc:${key}`, value, target, methodName)
        })
    },

    clearReflectMetadata: (target: object, methodName: string) => {
        Reflect.deleteMetadata('trpc:input:param', target, methodName)
        Reflect.deleteMetadata('trpc:context:param', target, methodName)
        Reflect.deleteMetadata('trpc:query', target, methodName)
        Reflect.deleteMetadata('trpc:mutation', target, methodName)
        Reflect.deleteMetadata('trpc:router', target)
    },
}

// Common test configurations
export const TestConfigs = {
    basicTRPCOptions: {
        basePath: '/api/trpc',
    },

    websocketTRPCOptions: {
        basePath: '/api/trpc',
        websocket: {
            enabled: true,
            port: 3001,
        },
    },

    contextTRPCOptions: {
        basePath: '/api/trpc',
        context: {
            create: jest.fn().mockReturnValue(Promise.resolve({})) as any,
        } as any,
    },
}
