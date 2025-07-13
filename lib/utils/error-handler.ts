import { Logger } from '@nestjs/common'

export class ErrorHandler {
    private static readonly logger = new Logger('TRPCErrorHandler')

    static logError(context: string, message: string, error?: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.error(`${context}: ${message}`, error instanceof Error ? error.stack : errorMessage)
    }

    static logWarning(context: string, message: string, details?: unknown): void {
        const warningDetails = details ? ` - ${JSON.stringify(details)}` : ''
        this.logger.warn(`${context}: ${message}${warningDetails}`)
    }

    static logInfo(context: string, message: string): void {
        this.logger.log(`${context}: ${message}`)
    }

    static createError(context: string, message: string, originalError?: unknown): Error {
        const errorMessage = `${context}: ${message}`
        const error = new Error(errorMessage)

        if (originalError instanceof Error) {
            error.stack = originalError.stack
        }

        return error
    }
}
