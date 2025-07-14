import 'reflect-metadata'

export function createParameterDecorator(metadataKey: string) {
    return function (): (target: object, propertyKey: string | symbol, parameterIndex: number) => void {
        return (target: object, propertyKey: string | symbol, parameterIndex: number): void => {
            const existingParameters: number[] = (Reflect.getMetadata(metadataKey, target.constructor, propertyKey) as number[]) || []
            existingParameters.push(parameterIndex)
            Reflect.defineMetadata(metadataKey, existingParameters, target.constructor, propertyKey)
        }
    }
}
