import { AnyTRPCRouter, AnyTRPCProcedure } from '@trpc/server'

// Better type definitions for procedure handlers - matches tRPC's resolver signature
export type ProcedureHandler = (opts: { input: unknown; ctx: unknown }) => Promise<unknown>

// Better type definitions for router factory
export type RouterFactory = (procedures: Record<string, AnyTRPCProcedure | AnyTRPCRouter>) => AnyTRPCRouter

// Better type definitions for instance methods
export type InstanceMethod = (...args: unknown[]) => unknown

// Better type definitions for class instances
export interface ClassInstance {
    [key: string]: unknown
}

// Better type definitions for procedure definitions
export interface ProcedureDefinition {
    type: string
    inputs?: unknown[]
    output?: unknown
    inputName?: string
    outputName?: string
}

// Better type definitions for HTTP adapters
export interface HttpAdapter {
    getInstance: () => unknown
    getType: () => string
}
