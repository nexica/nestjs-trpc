import { z } from 'zod'

interface ProcedureInfo {
    input?: z.ZodObject<z.ZodRawShape>
    output?: z.ZodObject<z.ZodRawShape>
}

interface SchemaInfo {
    name: string
    definition: string
    typeName: string
    typeDefinition: string
    dependencies?: string[]
    schema: z.ZodTypeAny
}

interface ZodTypeDef extends z.ZodTypeDef {
    typeName: z.ZodFirstPartyTypeKind
}

type ZodTypeAny = z.ZodType<any, ZodTypeDef, any>

export class SchemaGenerator {
    public schemaRegistry: Map<string, SchemaInfo> = new Map()
    public processedSchemas: Set<string> = new Set()
    private schemaNameCache: Map<ZodTypeAny, string> = new Map()
    private processingSchemas: Set<ZodTypeAny> = new Set()
    private schemaHashCache: Map<ZodTypeAny, string> = new Map()

    private schemaProcessingQueue: Array<{
        schema: z.ZodObject<z.ZodRawShape>
        schemaName: string
        routerName: string
        procedureName: string
        firstIteration: boolean
    }> = []

    public clear(): void {
        this.schemaRegistry.clear()
        this.processedSchemas.clear()
        this.schemaNameCache.clear()
        this.processingSchemas.clear()
        this.schemaHashCache.clear()
        this.schemaProcessingQueue = []
    }

    public getSchemaTypeDefinition(schemaName: string): string {
        return this.schemaRegistry.get(schemaName)?.typeDefinition || ''
    }

    public collectSchemas(routerName: string, procedures: Record<string, ProcedureInfo>): void {
        for (const [procedureName, procedure] of Object.entries(procedures)) {
            if (procedure.input) {
                const inputSchemaName = this.generateSchemaName(routerName, procedureName, 'Input')

                this.queueSchemaForProcessing(procedure.input, inputSchemaName, routerName, procedureName, true)
            }
            if (procedure.output) {
                const outputSchemaName = this.generateSchemaName(routerName, procedureName, 'Output')

                this.queueSchemaForProcessing(procedure.output, outputSchemaName, routerName, procedureName, true)
            }
        }

        this.processSchemaQueue()
    }

    private queueSchemaForProcessing(
        schema: z.ZodObject<z.ZodRawShape>,
        schemaName: string,
        routerName: string,
        procedureName: string,
        firstIteration: boolean = false
    ): void {
        if (!this.schemaRegistry.has(schemaName) && !this.isSchemaInQueue(schema, schemaName)) {
            this.schemaProcessingQueue.push({
                schema,
                schemaName,
                routerName,
                procedureName,
                firstIteration,
            })
        }
    }

    private isSchemaInQueue(schema: z.ZodObject<z.ZodRawShape>, schemaName: string): boolean {
        return this.schemaProcessingQueue.some((item) => item.schema === schema && item.schemaName === schemaName)
    }

    // Queue processing to prevent hitting the stack limit when processing large schemas (circular & recursive dependencies)
    private processSchemaQueue(): void {
        let iterations = 0
        const maxIterations = 1000

        while (this.schemaProcessingQueue.length > 0 && iterations < maxIterations) {
            iterations++
            const currentBatch = [...this.schemaProcessingQueue]
            this.schemaProcessingQueue = []

            for (const { schema, schemaName, routerName, procedureName, firstIteration } of currentBatch) {
                try {
                    this.processSingleSchema(schema, schemaName, routerName, procedureName, firstIteration)
                } catch (error) {
                    console.warn(`Error processing schema ${schemaName}:`, error)
                }
            }
        }

        if (iterations >= maxIterations) {
            console.warn('Schema processing stopped due to iteration limit - possible infinite loop detected')
        }
    }

    private processSingleSchema(
        schema: z.ZodObject<z.ZodRawShape>,
        schemaName: string,
        routerName: string,
        procedureName: string,
        firstIteration: boolean
    ): void {
        if (this.schemaRegistry.has(schemaName)) {
            return
        }

        try {
            const [schemaDefinition, typeDefinition, dependencies] = this.getZodDefinitionStringIterative(
                schema,
                routerName,
                procedureName,
                firstIteration
            )

            this.schemaRegistry.set(schemaName, {
                name: schemaName,
                definition: schemaDefinition,
                typeName: `${schemaName}Type`,
                typeDefinition,
                dependencies,
                schema: schema,
            })
        } catch (error) {
            console.warn(`Failed to process schema ${schemaName}:`, error)
            this.schemaRegistry.set(schemaName, {
                name: schemaName,
                definition: 'z.unknown()',
                typeName: `${schemaName}Type`,
                typeDefinition: 'unknown',
                dependencies: [],
                schema: schema,
            })
        }
    }

    public isZodObject(schema: ZodTypeAny): schema is z.ZodObject<z.ZodRawShape> {
        return schema && schema._def && schema._def.typeName === z.ZodFirstPartyTypeKind.ZodObject
    }

    public generateSchemaName(routerName: string, procedureName: string, type: 'Input' | 'Output'): string {
        const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
        const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '')

        const routerPart = capitalize(sanitize(routerName))
        const procedurePart = capitalize(sanitize(procedureName))

        return `${routerPart}${procedurePart}${type}Schema`
    }

    private expandZodObjectInline(schema: z.ZodObject<z.ZodRawShape>, routerName: string, procedureName: string): [string, string, string[]] {
        try {
            if (!schema._def.shape) {
                return ['z.unknown()', 'z.ZodUnknown', []]
            }

            const shape = schema._def.shape()
            if (typeof shape !== 'object' || shape === null) {
                return ['z.unknown()', 'z.ZodUnknown', []]
            }

            const schemaFields = Object.entries(shape)
                .map(([key, fieldSchema]: [string, ZodTypeAny]) => {
                    const [definition, typeName, dependencies] = this.getZodDefinitionStringIterative(fieldSchema, routerName, procedureName)
                    if (dependencies.length > 0) {
                        return `get ${key}(): ${typeName} { return ${definition} as ${typeName} },`
                    }

                    return `${key}: ${definition},`
                })
                .join('\n')

            const typeNames = Object.entries(shape)
                .map(([key, fieldSchema]: [string, ZodTypeAny]) => {
                    const [definition, typeName, dependencies] = this.getZodDefinitionStringIterative(fieldSchema, routerName, procedureName)
                    if (typeName.includes('| null') || typeName.includes('| undefined')) {
                        key = `${key}?`
                    }
                    return `  ${key}: ${typeName};`
                })
                .join('\n')

            const dependencies = Object.entries(shape)
                .map(([key, fieldSchema]: [string, ZodTypeAny]) => {
                    const [definition, typeName, dependencies] = this.getZodDefinitionStringIterative(fieldSchema, routerName, procedureName)
                    return dependencies
                })
                .flat()

            return [`z.object({\n${schemaFields}\n}).strict()`, `{\n${typeNames}\n}`, dependencies]
        } catch (error) {
            console.warn('Failed to expand object inline:', error)
            return ['z.unknown()', 'z.ZodUnknown', []]
        }
    }

    private getZodDefinitionStringIterative(
        schema: ZodTypeAny,
        routerName: string,
        procedureName: string,
        firstIteration: boolean = false
    ): [string, string, string[]] {
        if (!schema || !schema._def) {
            return ['z.unknown()', 'z.ZodUnknown', []]
        }

        const typeName = schema._def.typeName

        switch (typeName) {
            case z.ZodFirstPartyTypeKind.ZodString:
                return ['z.string()', 'z.ZodString', []]
            case z.ZodFirstPartyTypeKind.ZodNumber:
                return ['z.number()', 'z.ZodNumber', []]
            case z.ZodFirstPartyTypeKind.ZodBoolean:
                return ['z.boolean()', 'z.ZodBoolean', []]
            case z.ZodFirstPartyTypeKind.ZodDate:
                return ['z.date()', 'z.ZodDate', []]
            case z.ZodFirstPartyTypeKind.ZodBigInt:
                return ['z.bigint()', 'z.ZodBigInt', []]
            case z.ZodFirstPartyTypeKind.ZodAny:
                return ['z.any()', 'z.ZodAny', []]
            case z.ZodFirstPartyTypeKind.ZodUnknown:
                return ['z.unknown()', 'z.ZodUnknown', []]
            case z.ZodFirstPartyTypeKind.ZodVoid:
                return ['z.void()', 'z.ZodVoid', []]
            case z.ZodFirstPartyTypeKind.ZodUndefined:
                return ['z.undefined()', 'z.ZodUndefined', []]
            case z.ZodFirstPartyTypeKind.ZodNull:
                return ['z.null()', 'z.ZodNull', []]
            case z.ZodFirstPartyTypeKind.ZodNever:
                return ['z.never()', 'z.ZodNever', []]
            case z.ZodFirstPartyTypeKind.ZodArray: {
                const typedSchema = schema as z.ZodArray<ZodTypeAny>
                const [elementType, elementTypeName, elementDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema._def.type,
                    routerName,
                    procedureName
                )

                let arrayTypeName = elementTypeName
                if (elementTypeName.includes(' | ') || elementTypeName.includes(' & ')) {
                    arrayTypeName = `(${elementTypeName})`
                }

                return [`z.array(${elementType})`, `z.ZodArray<${arrayTypeName}>`, elementDependencies]
            }
            case z.ZodFirstPartyTypeKind.ZodObject: {
                const typedSchema = schema as z.ZodObject<z.ZodRawShape>

                if (firstIteration) {
                    return this.expandZodObjectInline(typedSchema, routerName, procedureName)
                }

                const nestedSchemaName = this.generateNestedSchemaNameSafe(typedSchema)
                this.queueSchemaForProcessing(typedSchema, nestedSchemaName, routerName, procedureName, true)
                return [nestedSchemaName, `typeof ${nestedSchemaName}`, [nestedSchemaName]]
            }
            case z.ZodFirstPartyTypeKind.ZodOptional: {
                const typedSchema = schema as z.ZodOptional<ZodTypeAny>

                if (typedSchema._def.innerType._def?.typeName === z.ZodFirstPartyTypeKind.ZodObject && firstIteration) {
                    const innerObject = typedSchema._def.innerType as z.ZodObject<z.ZodRawShape>
                    const [objectDef, objectType, deps] = this.expandZodObjectInline(innerObject, routerName, procedureName)
                    return [`${objectDef}.optional()`, `z.ZodOptional<${objectType}>`, deps]
                }

                const [innerType, innerTypeName, innerDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema._def.innerType,
                    routerName,
                    procedureName
                )
                return [`${innerType}.optional()`, `z.ZodOptional<${innerTypeName}>`, innerDependencies]
            }
            case z.ZodFirstPartyTypeKind.ZodNullable: {
                const typedSchema = schema as z.ZodNullable<ZodTypeAny>

                if (typedSchema._def.innerType._def?.typeName === z.ZodFirstPartyTypeKind.ZodObject) {
                    const innerObject = typedSchema._def.innerType as z.ZodObject<z.ZodRawShape>
                    if (firstIteration) {
                        const [objectDef, objectType, deps] = this.expandZodObjectInline(innerObject, routerName, procedureName)
                        return [`${objectDef}.nullable()`, `z.ZodNullable<${objectType}>`, deps]
                    }
                }

                const [innerType, innerTypeName, innerDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema._def.innerType,
                    routerName,
                    procedureName
                )
                return [`${innerType}.nullable()`, `z.ZodNullable<${innerTypeName}>`, innerDependencies]
            }
            case z.ZodFirstPartyTypeKind.ZodEnum: {
                const typedSchema = schema as z.ZodEnum<[string, ...string[]]>
                const schemaValues = typedSchema._def.values.map((v) => `"${v}"`).join(', ')
                const typeValues = typedSchema._def.values.map((v) => `${v}: "${v}"`).join(', ')
                return [`z.enum([${schemaValues}])`, `z.ZodEnum<{ ${typeValues} }>`, []]
            }
            case z.ZodFirstPartyTypeKind.ZodUnion: {
                const typedSchema = schema as z.ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>
                const definitions = typedSchema._def.options
                    .map((opt: ZodTypeAny) => this.getZodDefinitionStringIterative(opt, routerName, procedureName)[0])
                    .join(', ')
                const definitionTypes = typedSchema._def.options
                    .map((opt: ZodTypeAny) => {
                        const typeName = this.getZodDefinitionStringIterative(opt, routerName, procedureName)[1]
                        return typeName
                    })
                    .join(', ')
                const dependencies = typedSchema._def.options
                    .map((opt: ZodTypeAny) => {
                        const dependencies = this.getZodDefinitionStringIterative(opt, routerName, procedureName)[2]
                        return dependencies
                    })
                    .flat()
                return [`z.union([${definitions}])`, `z.ZodUnion<[${definitionTypes}]>`, dependencies]
            }
            case z.ZodFirstPartyTypeKind.ZodIntersection: {
                const typedSchema = schema as z.ZodIntersection<ZodTypeAny, ZodTypeAny>
                const [leftType, leftTypeName, leftDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema._def.left,
                    routerName,
                    procedureName
                )
                const [rightType, rightTypeName, rightDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema._def.right,
                    routerName,
                    procedureName
                )
                return [
                    `z.intersection(${leftType}, ${rightType})`,
                    `z.ZodIntersection<${leftTypeName}, ${rightTypeName}>`,
                    [...leftDependencies, ...rightDependencies],
                ]
            }
            case z.ZodFirstPartyTypeKind.ZodLazy: {
                const typedSchema = schema as z.ZodLazy<ZodTypeAny>
                try {
                    const innerSchema = typedSchema._def.getter?.()
                    if (innerSchema && innerSchema !== schema) {
                        const [innerType, innerTypeName, innerDependencies] = this.getZodDefinitionStringIterative(
                            innerSchema,
                            routerName,
                            procedureName
                        )
                        return [`z.lazy(() => ${innerType})`, `z.ZodLazy<${innerTypeName}>`, innerDependencies]
                    }
                } catch (error) {
                    console.warn('Error processing lazy schema:', error)
                }
                return [`z.lazy(() => z.unknown())`, 'z.ZodUnknown', []]
            }
            case z.ZodFirstPartyTypeKind.ZodRecord: {
                const typedSchema = schema as z.ZodRecord<z.KeySchema, ZodTypeAny>
                if (typedSchema._def.valueType) {
                    const [valueType, valueTypeName, valueDependencies] = this.getZodDefinitionStringIterative(
                        typedSchema._def.valueType,
                        routerName,
                        procedureName
                    )
                    return [`z.record(${valueType})`, `z.ZodRecord<string, ${valueTypeName}>`, valueDependencies]
                }
                return [`z.record(z.unknown())`, 'z.ZodRecord<string, z.ZodUnknown>', []]
            }
            case z.ZodFirstPartyTypeKind.ZodTuple: {
                const typedSchema = schema as z.ZodTuple<[ZodTypeAny, ...ZodTypeAny[]]>
                if (typedSchema._def.items) {
                    const definitions = typedSchema._def.items
                        .map((item: ZodTypeAny) => this.getZodDefinitionStringIterative(item, routerName, procedureName)[0])
                        .join(', ')
                    const definitionTypes = typedSchema._def.items
                        .map((item: ZodTypeAny) => this.getZodDefinitionStringIterative(item, routerName, procedureName)[1])
                        .join(', ')
                    const dependencies = typedSchema._def.items
                        .map((item: ZodTypeAny) => this.getZodDefinitionStringIterative(item, routerName, procedureName)[2])
                        .flat()
                    return [`z.tuple([${definitions}])`, `z.ZodTuple<[${definitionTypes}]>`, dependencies]
                }
                return [`z.tuple([])`, 'z.ZodTuple<[]>[]', []]
            }
            case z.ZodFirstPartyTypeKind.ZodLiteral: {
                const typedSchema = schema as z.ZodLiteral<z.Primitive>
                const value = typedSchema._def.value
                if (typeof value === 'string') {
                    return [`z.literal("${value}")`, `z.ZodLiteral<"${value}">`, []]
                }
                return [`z.literal(${value?.toString()})`, `z.ZodLiteral<${value?.toString()}>`, []]
            }
            default:
                console.warn(`Unknown schema type: ${typeName}`)
                return ['z.unknown()', 'z.ZodUnknown', []]
        }
    }

    private generateNestedSchemaNameSafe(schema: z.ZodObject<z.ZodRawShape>): string {
        if (this.schemaNameCache.has(schema)) {
            return this.schemaNameCache.get(schema)!
        }

        const structureHash = this.createSchemaHashSafe(schema)
        const finalName = `Schema${structureHash}`

        let counter = 1
        let uniqueName = finalName
        while (this.schemaRegistry.has(uniqueName)) {
            uniqueName = `${finalName}${counter}`
            counter++
        }

        this.schemaNameCache.set(schema, uniqueName)
        return uniqueName
    }

    private createSchemaHashSafe(schema: z.ZodObject<z.ZodRawShape>): string {
        if (this.schemaHashCache.has(schema)) {
            return this.schemaHashCache.get(schema)!
        }

        try {
            const typeName = schema._def?.typeName || 'unknown'
            let hashInput = typeName.toString()

            try {
                const shape = schema._def?.shape?.() || schema._def?.shape
                if (shape && typeof shape === 'object') {
                    const keys = Object.keys(shape).sort().slice(0, 10)
                    hashInput += '_' + keys.join('_')
                }
            } catch (error) {
                console.warn('Could not get schema shape for hash:', error)
            }

            let hash = 0

            for (let i = 0; i < hashInput.length; i++) {
                const char = hashInput.charCodeAt(i)

                hash = (hash << 5) - hash + char
                hash = hash & hash
            }

            const result = Math.abs(hash).toString(36).toUpperCase()
            this.schemaHashCache.set(schema, result)
            return result
        } catch (error) {
            console.warn('Error creating schema hash:', error)
            const result = 'Unknown'
            this.schemaHashCache.set(schema, result)
            return result
        }
    }

    public topologicalSort(): string[] {
        const allSchemas = Array.from(this.schemaRegistry.keys())
        const result: string[] = []
        const visited = new Set<string>()
        const visiting = new Set<string>()

        const visit = (schemaName: string): void => {
            if (visited.has(schemaName)) {
                return
            }

            if (visiting.has(schemaName)) {
                visited.add(schemaName)
                result.push(schemaName)
                return
            }

            visiting.add(schemaName)

            const schemaInfo = this.schemaRegistry.get(schemaName)
            if (schemaInfo?.dependencies) {
                const allDeps = [...new Set(schemaInfo.dependencies)]
                const uniqueDeps = allDeps.filter((dep) => dep !== schemaName && this.schemaRegistry.has(dep))

                for (const dep of uniqueDeps) {
                    visit(dep)
                }
            }

            visiting.delete(schemaName)
            visited.add(schemaName)
            result.push(schemaName)
        }

        for (const schemaName of allSchemas) {
            visit(schemaName)
        }

        return result
    }
}
