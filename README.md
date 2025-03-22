# NestJS tRPC

A TypeScript integration package that bridges NestJS and tRPC, enabling fully type-safe API development without sacrificing the powerful features of NestJS. This package automatically generates tRPC server definition files from NestJS decorators, allowing you to:

- Build end-to-end typesafe APIs with NestJS as your backend framework
- Leverage NestJS dependency injection, modules, and lifecycle while getting tRPC's type safety
- Eliminate manual schema definition through automatic generation
- Use familiar decorator patterns for defining tRPC routers, queries, and mutations
- Integrate with Express and other NestJS-compatible frameworks

## Features

- Generate tRPC schema files from NestJS decorators (tRPC v11)
- Type-safe APIs without manually defining schemas
- NestJS decorators for tRPC routers, queries, mutations, and inputs
- Middleware support for tRPC procedures
- Express integration
- Zod integration

## Future Plans

- Integration with subscription procedures
- Compatibility with more drivers such as fastify

## Experimental

- `trpc-ui` integration (forked from `trpc-panel`) - this currently struggles with large apps and recursive reference schemas

## Installation

```bash
# npm
npm install @nexica/nestjs-trpc

# pnpm
pnpm add @nexica/nestjs-trpc

# yarn
yarn add @nexica/nestjs-trpc
```

## Peer Dependencies

Make sure you have the following peer dependencies installed:

```bash
npm install @nestjs/common @nestjs/core @trpc/server zod
```

## Modes

### Serve

The default behavior when running the NestJS app. This mode serves your tRPC API endpoints.

### Generate

- Generates and outputs the appRouter definition based on tRPC decorator usage.
- Requires setting the `TRPC_SCHEMA_GENERATION` environment variable to `true`, then running the NestJS app.
- Tip: Install `cross-env` and add the following script to your package.json:
    ```bash
    "generate-trpc": "cross-env TRPC_SCHEMA_GENERATION=true nest start"
    ```

## Usage

### Create the TrpcModule

```typescript
import { Module } from '@nestjs/common'
import { TRPCModule } from '@nexica/nestjs-trpc'
import { AuthService } from '@/trpc/middleware/auth/auth.service'
import { RequestContext, RequestContextFactory } from './context/app.context'
import { UserModule } from './routers/user/user.module'

const superjson = require('fix-esm').require('superjson')

@Module({
    imports: [
        UserModule,
        TRPCModule.forRoot<RequestContext>({
            transformer: superjson, // Serializes dates, maps, sets, etc.
            outputPath: './../../packages/api-trpc/src/server.ts', // appRouter schema output location
            injectFiles: ['@/zod/**/*'], // Glob pattern of which the file contents will be added to the output file
            context: RequestContextFactory<RequestContext>, // More on this below
            basePath: '/trpc', // tRPC endpoint prefix - defaults to /trpc
        }),
    ],
    providers: [AuthService, RequestContextFactory<RequestContext>],
})
export class TrpcModule {}
```

### Create the RequestContextFactory

This factory creates the context object that will be available in all your tRPC procedures.
It allows you to add custom properties and middleware for authentication, logging, etc.

```typescript
import { Injectable } from '@nestjs/common'
import { ContextOptions, TRPCContext } from '@nexica/nestjs-trpc'

export interface RequestContext extends ContextOptions {
    // add any custom properties you want to add to the context
    requestId: string
    startTime: number
}

@Injectable()
export class RequestContextFactory<TContext extends ContextOptions> implements TRPCContext<TContext> {
    async create(opts: TContext): Promise<TContext> {
        return {
            ...opts, // base properties (req, res, info, +trpc properties such as the appRouter definition)
            // populate the custom properties, you can also use middleware to populate them.
            requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startTime: Date.now(),
        }
    }
}
```

### Create a router

```typescript
import { Inject } from '@nestjs/common'
import { Input, Middleware, Mutation, Query, Router } from '@nexica/nestjs-trpc'
import { UserService } from './user.service'
import { ApiKeyMiddleware } from '@/trpc/middleware/auth/auth.middleware' // Custom middleware
import { UserCreateArgsSchema, UserSchema, UserFindFirstArgsSchema } from '@/zod' // Zod schemas
import { z } from 'zod'

@Router() // Declare this class as a tRPC router
@Middleware(ApiKeyMiddleware) // Optional - Apply middleware to all procedures in this router (can also be applied to individual procedures)
export class UserRouter {
    constructor(
        @Inject(UserService)
        private readonly userService: UserService
    ) {}

    @Query({
        // Define this method as a 'Query' procedure
        input: UserFindFirstArgsSchema, // Optional - Define the input schema (Zod schema)
        output: UserSchema.nullable(), // Optional - Define the output schema (Zod schema)
    }) // @Input() decorator gives access to the validated input data
    async findFirst(@Input() input: z.infer<typeof UserFindFirstArgsSchema>) {
        return await this.userService.findFirst(input)
    }

    @Mutation({
        // Define this method as a 'Mutation' procedure
        input: UserCreateArgsSchema, // Optional - Define the input schema (Zod schema)
        output: UserSchema, // Optional - Define the output schema (Zod schema)
    }) // @Input() decorator gives access to the validated input data
    async create(@Input() input: z.infer<typeof UserCreateArgsSchema>) {
        return await this.userService.create(input)
    }
}
```

### Create middleware

```typescript
import { TRPCError } from '@trpc/server'
import { MiddlewareFn } from '@nexica/nestjs-trpc'
import { AuthService } from './auth.service'
import { RequestContext } from '@/trpc/context/app.context'

// Auth class for all our auth middlewares
export class AuthMiddlewares {
    constructor(private readonly authService: AuthService) {}

    // Implement `MiddlewareFn` with our custom `RequestContext`
    public readonly ApiKey: MiddlewareFn<RequestContext> = async (opts) => {
        const { ctx, next } = opts // ctx takes the form of our `RequestContext`
        if (!this.authService.checkApiKey(ctx.req)) {
            throw new TRPCError({ code: 'UNAUTHORIZED' })
        }

        return next({ ctx }) // Passes control to the next middleware in the chain (or to the resolver if no middleware remains), forwarding the context
    }
}

// Export specific middleware instance for direct import and use in router decorators
export const ApiKeyMiddleware = new AuthMiddlewares(new AuthService()).ApiKey
```
## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Jamie Fairweather

## All contributors

<a href="https://github.com/nexica/nestjs-trpc/graphs/contributors">
  <p align="center">
    <img width="720" height="50" src="https://contrib.rocks/image?repo=nexica/nestjs-trpc" alt="A table of avatars from the project's contributors" />
  </p>
</a>

