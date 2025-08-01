import { EventEmitter } from 'events'
import { ErrorHandler } from '../utils/error-handler'

export interface SubscriptionHelperOptions<T = unknown> {
    /** The EventEmitter instance to listen to */
    eventEmitter: EventEmitter
    /** The event name to listen for */
    eventName: string
    /** Optional error event name (defaults to 'error') */
    errorEventName?: string
    /** Maximum number of events to queue before dropping oldest (prevents memory leaks) */
    maxQueueSize?: number
    /** Whether to drop new events when queue is full (default: false - drops oldest) */
    dropNewOnFull?: boolean
    /** Timeout for waiting for events (in milliseconds) */
    timeout?: number
    /** Whether to throw on timeout (default: false - continues waiting) */
    throwOnTimeout?: boolean
    /** Whether to continue after errors (default: false) */
    resilientMode?: boolean
    /** Custom filter function for events */
    filter?: (event: unknown) => boolean
    /** Custom transform function for events */
    transform?: (event: unknown) => T
    /** Type guard function to validate event type */
    typeGuard?: (event: unknown) => event is T
    /** AbortSignal to cancel the subscription */
    signal?: AbortSignal
    /** Custom error handler */
    onError?: (error: Error, context: { eventName: string; stats: SubscriptionStats }) => void
}

export interface SubscriptionStats {
    eventsProcessed: number
    errorsEncountered: number
    currentQueueSize: number
    startTime: number
    lastEventTime: number | null
}

export interface SubscriptionController {
    close(): void
    isClosed(): boolean
    getStats(): SubscriptionStats
}

/**
 * Creates an async iterable for tRPC subscriptions based on EventEmitter events
 * @param options Configuration options for the subscription
 * @returns Object containing the AsyncIterable and controller for management
 */
export function createEventSubscription<T>(options: SubscriptionHelperOptions<T>): {
    subscription: AsyncIterable<T>
    controller: SubscriptionController
} {
    const {
        eventEmitter,
        eventName,
        errorEventName = `${eventName}Error`,
        maxQueueSize = 1000,
        dropNewOnFull = false,
        timeout,
        throwOnTimeout = false,
        resilientMode = false,
        filter,
        transform,
        typeGuard,
        signal,
        onError,
    } = options

    const eventQueue: T[] = []
    let waitingResolver: ((value: { event?: T; error?: Error; timeout?: boolean }) => void) | null = null
    let hasError = false
    let currentError: Error | null = null
    let isClosed = false

    const stats: SubscriptionStats = {
        eventsProcessed: 0,
        errorsEncountered: 0,
        currentQueueSize: 0,
        startTime: Date.now(),
        lastEventTime: null,
    }

    const processEvent = (rawEvent: unknown): T | null => {
        try {
            // Apply filter if provided
            if (filter && !filter(rawEvent)) {
                return null
            }

            // Apply type guard if provided
            if (typeGuard && !typeGuard(rawEvent)) {
                ErrorHandler.logError('SubscriptionHelper', `Type guard failed for event on '${eventName}'`, new Error('Type validation failed'))
                return null
            }

            // Apply transform if provided, otherwise use type assertion
            const processedEvent = transform ? transform(rawEvent) : (rawEvent as T)

            stats.eventsProcessed++
            stats.lastEventTime = Date.now()

            return processedEvent
        } catch (error) {
            ErrorHandler.logError(
                'SubscriptionHelper',
                `Error processing event on '${eventName}':`,
                error instanceof Error ? error : new Error(String(error))
            )
            return null
        }
    }

    const handler = (rawEvent: unknown) => {
        if (isClosed) return

        const event = processEvent(rawEvent)
        if (event === null) return

        if (waitingResolver) {
            waitingResolver({ event })
            waitingResolver = null
        } else {
            // Queue management with memory leak prevention
            if (eventQueue.length >= maxQueueSize) {
                if (dropNewOnFull) {
                    return // Drop new event
                } else {
                    eventQueue.shift() // Drop oldest event
                }
            }
            eventQueue.push(event)
            stats.currentQueueSize = eventQueue.length
        }
    }

    const errorHandler = (error: Error) => {
        stats.errorsEncountered++

        if (onError) {
            try {
                onError(error, { eventName, stats: { ...stats } })
            } catch (callbackError) {
                ErrorHandler.logError(
                    'SubscriptionHelper',
                    `Error in custom error handler for '${eventName}':`,
                    callbackError instanceof Error ? callbackError : new Error(String(callbackError))
                )
            }
        }

        ErrorHandler.logError('SubscriptionHelper', `EventEmitter error on '${eventName}':`, error)

        if (resilientMode) {
            // Log but don't throw - continue processing
            return
        }

        hasError = true
        currentError = error

        if (waitingResolver) {
            waitingResolver({ error })
            waitingResolver = null
        }
    }

    const cleanup = () => {
        if (isClosed) return

        isClosed = true
        eventEmitter.removeListener(eventName, handler)
        eventEmitter.removeListener(errorEventName, errorHandler)

        if (waitingResolver) {
            waitingResolver({ error: new Error('Subscription closed') })
            waitingResolver = null
        }
    }

    // Handle AbortSignal
    if (signal) {
        if (signal.aborted) {
            throw new Error('Subscription cancelled')
        }
        signal.addEventListener('abort', cleanup)
    }

    // Add event listeners
    eventEmitter.addListener(eventName, handler)
    eventEmitter.addListener(errorEventName, errorHandler)

    const controller: SubscriptionController = {
        close: cleanup,
        isClosed: () => isClosed,
        getStats: () => ({ ...stats, currentQueueSize: eventQueue.length }),
    }

    const subscription: AsyncIterable<T> = {
        async *[Symbol.asyncIterator]() {
            try {
                while (!isClosed) {
                    // Check for errors first (if not in resilient mode)
                    if (hasError && !resilientMode) {
                        throw currentError!
                    }

                    // Reset error state in resilient mode
                    if (resilientMode && hasError) {
                        hasError = false
                        currentError = null
                    }

                    // If we have queued events, yield them
                    if (eventQueue.length > 0) {
                        const event = eventQueue.shift()!
                        stats.currentQueueSize = eventQueue.length
                        yield event
                        continue
                    }

                    // Wait for the next event with optional timeout
                    const promises: Promise<{ event?: T; error?: Error; timeout?: boolean }>[] = [
                        new Promise<{ event?: T; error?: Error }>((resolve) => {
                            waitingResolver = resolve
                        }),
                    ]

                    if (timeout) {
                        promises.push(new Promise<{ timeout: boolean }>((resolve) => setTimeout(() => resolve({ timeout: true }), timeout)))
                    }

                    const result = await Promise.race(promises)

                    // Handle timeout
                    if ('timeout' in result) {
                        if (throwOnTimeout) {
                            throw new Error(`Subscription timeout after ${timeout}ms`)
                        }
                        continue // Continue waiting for events
                    }

                    // Handle the result
                    if (result.error && !resilientMode) {
                        throw result.error
                    }

                    if (result.event) {
                        yield result.event
                    }
                }
            } finally {
                cleanup()
            }
        },
    }

    return { subscription, controller }
}

// Export for testing and utilities
export const createMockEventEmitter = () => {
    const emitter = new EventEmitter()
    return {
        emitter,
        emit: (event: string, data: unknown) => emitter.emit(event, data),
        emitError: (event: string, error: Error) => emitter.emit(`${event}Error`, error),
    }
}

export const createSubscriptionTester = <T>(
    subscription: AsyncIterable<T>
): {
    next: () => Promise<T>
    collect: (count: number) => Promise<T[]>
    close: () => void
} => {
    const iterator = subscription[Symbol.asyncIterator]()

    return {
        next: async () => {
            const result = await iterator.next()
            if (result.done) {
                throw new Error('Subscription ended')
            }
            return result.value
        },
        collect: async (count: number) => {
            const results: T[] = []
            for (let i = 0; i < count; i++) {
                const result = await iterator.next()
                if (result.done) break
                results.push(result.value)
            }
            return results
        },
        close: () => {
            void iterator.return?.()
        },
    }
}
