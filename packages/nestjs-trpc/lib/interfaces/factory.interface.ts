import { Constructor, Class } from 'type-fest'

export interface RouterInstance {
    name: string
    path: string
    instance: unknown
    middlewares: Array<Class<any> | Constructor<any>>
    alias?: string
}
