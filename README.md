# DISCLAMER
This project was originally developed in my spare time as part of a larger framework stack I was building. While I no longer actively use or develop this project, I’ll continue to provide occasional maintenance updates, such as dependency bumps and small patches. However, ongoing feature development is not guaranteed.

# NestJS tRPC

A TypeScript integration package that bridges NestJS and tRPC, enabling fully type-safe API development without sacrificing the powerful features of NestJS.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/nexica/nestjs-trpc/blob/dev/LICENSE)

[![Documentation](https://img.shields.io/badge/Documentation-Nexica-asda?style=for-the-badge)](https://nexica.github.io/nestjs-trpc/)

## What is NestJS tRPC?

NestJS tRPC automatically generates tRPC server definition files from NestJS decorators, allowing you to:

- **Build end-to-end typesafe APIs** with NestJS as your backend framework
- **Leverage NestJS dependency injection, modules, and lifecycle** while getting tRPC's type safety
- **Eliminate manual schema definition** through automatic generation
- **Use familiar decorator patterns** for defining tRPC routers, queries, and mutations
- **Integrate with Express and Fastify** frameworks seamlessly

## Key Features

✨ **Automatic Schema Generation** - Generate tRPC schema files from NestJS decorators (tRPC v11)  
🔒 **Type-Safe APIs** - Full end-to-end type safety without manually defining schemas  
🎯 **NestJS Decorators** - Familiar `@Router()`, `@Query()`, `@Mutation()`, `@Subscription()` decorators  
📥 **Parameter Decorators** - `@Input()` and `@Context()` for accessing validated data and request context  
⚡ **Middleware Support** - Full tRPC middleware integration  
📡 **Real-time Subscriptions** - WebSocket support for live data updates  
🚀 **Multiple Drivers** - Express and Fastify support  
🔍 **Zod Integration** - Built-in validation with Zod schemas

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

[Jamie Fairweather](https://github.com/Jamie-Fairweather)

## Contributors

<a href="https://github.com/nexica/nestjs-trpc/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nexica/nestjs-trpc" />
</a>
