# 1.0.0 (2025-07-21)

### 🎉 Initial Release

A comprehensive TypeScript integration package that bridges NestJS and tRPC, enabling fully type-safe API development.

### ✨ Core Features

#### **Framework Integration**
- **NestJS + tRPC Bridge** - Seamless integration between NestJS and tRPC
- **tRPC v11 Compatibility** - Built for the latest tRPC version
- **Automatic Schema Generation** - Generate tRPC schema files from NestJS decorators
- **End-to-end Type Safety** - Full TypeScript support from backend to frontend

#### **Decorator System**
- **`@Router()`** - Define tRPC routers with NestJS-style decorators
- **`@Query()`** - Create type-safe query procedures
- **`@Mutation()`** - Create type-safe mutation procedures  
- **`@Subscription()`** - Create real-time subscription procedures
- **`@Input()`** - Access validated request data with parameter decorators
- **`@Context()`** - Access tRPC context and request metadata
- **`@Middleware()`** - Apply tRPC middleware with decorator syntax

#### **Multi-Platform Support**
- **Express Driver** - Full Express.js integration with HTTP and WebSocket support
- **Fastify Driver** - Complete Fastify integration with high-performance capabilities
- **Automatic Platform Detection** - Smart driver selection based on your NestJS setup

#### **Real-time Capabilities**
- **WebSocket Subscriptions** - Real-time data streaming with WebSocket support
- **Flexible WebSocket Configuration** - Support for separate ports or attached servers
- **Subscription Helpers** - Advanced utilities for managing event subscriptions and AsyncIterables

#### **Validation & Schemas**
- **Zod 4 Integration** - Built-in validation with Zod schemas
- **Schema Validation** - Automatic input/output validation
- **Type Inference** - Full TypeScript type inference from Zod schemas

#### **Operating Modes**
- **Normal Mode** - Standard runtime operation with HTTP/WebSocket servers
- **Schema Generation Mode** - Generate client-side schema files from decorators
- **Watch Mode** - Live schema regeneration during development with `nest start --watch`

#### **Advanced Features**
- **Data Transformers** - Support for SuperJSON and Devalue serialization
- **Middleware System** - Full tRPC middleware integration with authentication, logging, etc.
- **Context Management** - Flexible context creation with dependency injection support
- **Error Handling** - Comprehensive error handling utilities and logging
- **CLI Support** - Command-line interface for schema generation and utilities