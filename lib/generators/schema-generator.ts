import z, { ZodObject } from 'zod/v4'

interface ProcedureInfo {
    input?: ZodTypeAny
    output?: ZodTypeAny
}

interface SchemaInfo {
    name: string
    definition: string
    typeName: string
    typeDefinition: string
    dependencies?: string[]
    schema: ZodTypeAny
}

// interface ZodTypeDef extends z.core.$ZodTypeDef {
//     // typeName: z.ZodFirstPartyTypeKind
// }

type ZodTypeAny = z.ZodType

export class SchemaGenerator {
    public schemaRegistry: Map<string, SchemaInfo> = new Map()
    public processedSchemas: Set<string> = new Set()
    private schemaNameCache: Map<ZodTypeAny, string> = new Map()
    private processingSchemas: Set<ZodTypeAny> = new Set()
    private schemaHashCache: Map<ZodTypeAny, string> = new Map()

    private schemaProcessingQueue: Array<{
        schema: ZodTypeAny
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
        schema: ZodTypeAny,
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

    private isSchemaInQueue(schema: ZodTypeAny, schemaName: string): boolean {
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

    private processSingleSchema(schema: ZodTypeAny, schemaName: string, routerName: string, procedureName: string, firstIteration: boolean): void {
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

    public isZodObject(schema: ZodTypeAny): schema is z.ZodObject {
        return schema && schema.def.type === 'object'
    }

    public generateSchemaName(routerName: string, procedureName: string, type: 'Input' | 'Output'): string {
        const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
        const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '')

        const routerPart = capitalize(sanitize(routerName))
        const procedurePart = capitalize(sanitize(procedureName))

        return `${routerPart}${procedurePart}${type}Schema`
    }

    private expandZodObjectInline(schema: z.ZodObject, routerName: string, procedureName: string): [string, string, string[]] {
        try {
            if (!schema.def.shape) {
                return ['z.unknown()', 'z.ZodUnknown', []]
            }

            const shape = schema.def.shape
            if (typeof shape !== 'object' || shape === null) {
                return ['z.unknown()', 'z.ZodUnknown', []]
            }

            const schemaFields = Object.entries(shape)
                .map(([key, fieldSchema]) => {
                    const [definition, typeName, dependencies] = this.getZodDefinitionStringIterative(
                        fieldSchema as ZodTypeAny,
                        routerName,
                        procedureName
                    )
                    if (dependencies.length > 0) {
                        return `get ${key}(): ${typeName} { return ${definition} as ${typeName} },`
                        // return `get ${key}() { return ${definition} },`
                    }

                    return `${key}: ${definition},`
                })
                .join('\n')

            const typeNames = Object.entries(shape)
                .map(([key, fieldSchema]) => {
                    const [definition, typeName, dependencies] = this.getZodDefinitionStringIterative(
                        fieldSchema as ZodTypeAny,
                        routerName,
                        procedureName
                    )
                    if (typeName.includes('| null') || typeName.includes('| undefined')) {
                        key = `${key}?`
                    }
                    return `  ${key}: ${typeName};`
                })
                .join('\n')

            const dependencies = Object.entries(shape)
                .map(([key, fieldSchema]) => {
                    const [definition, typeName, dependencies] = this.getZodDefinitionStringIterative(
                        fieldSchema as ZodTypeAny,
                        routerName,
                        procedureName
                    )
                    return dependencies
                })
                .flat()

            let objectConfigSuffix = ''
            if (schema.def.catchall && (schema.def.catchall as ZodTypeAny).def.type !== 'never') {
                const catchallSchema = schema.def.catchall as ZodTypeAny
                const [catchallDef] = this.getZodDefinitionStringIterative(catchallSchema, routerName, procedureName)
                objectConfigSuffix = `.catchall(${catchallDef})`
            }

            let objectDescription = ''
            if (schema.description) {
                objectDescription = `.describe("${schema.description}")`
            }

            return [`z.object({\n${schemaFields}\n})${objectConfigSuffix}${objectDescription}`, `{\n${typeNames}\n}`, dependencies]
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
        if (!schema || !schema.def) {
            return ['z.unknown()', 'z.ZodUnknown', []]
        }

        const typeName = schema.def.type

        switch (typeName) {
            case 'string':
                return ['z.string()', 'z.ZodString', []]
            case 'number':
                return ['z.number()', 'z.ZodNumber', []]
            case 'boolean':
                return ['z.boolean()', 'z.ZodBoolean', []]
            case 'date':
                return ['z.date()', 'z.ZodDate', []]
            case 'bigint':
                return ['z.bigint()', 'z.ZodBigInt', []]
            case 'any':
                return ['z.any()', 'z.ZodAny', []]
            case 'unknown':
                return ['z.unknown()', 'z.ZodUnknown', []]
            case 'void':
                return ['z.void()', 'z.ZodVoid', []]
            case 'undefined':
                return ['z.undefined()', 'z.ZodUndefined', []]
            case 'null':
                return ['z.null()', 'z.ZodNull', []]
            case 'never':
                return ['z.never()', 'z.ZodNever', []]
            case 'array': {
                const typedSchema = schema as z.ZodArray<ZodTypeAny>
                const [elementType, elementTypeName, elementDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema.def.element,
                    routerName,
                    procedureName
                )

                let arrayTypeName = elementTypeName
                if (elementTypeName.includes(' | ') || elementTypeName.includes(' & ')) {
                    arrayTypeName = `(${elementTypeName})`
                }

                return [`z.array(${elementType})`, `z.ZodArray<${arrayTypeName}>`, elementDependencies]
            }
            case 'object': {
                const typedSchema = schema as z.ZodObject

                if (firstIteration) {
                    return this.expandZodObjectInline(typedSchema, routerName, procedureName)
                }

                const nestedSchemaName = this.generateNestedSchemaNameSafe(typedSchema)
                this.queueSchemaForProcessing(typedSchema, nestedSchemaName, routerName, procedureName, true)
                return [nestedSchemaName, `typeof ${nestedSchemaName}`, [nestedSchemaName]]
            }
            case 'optional': {
                const typedSchema = schema as z.ZodOptional<ZodTypeAny>

                if (typedSchema.def.innerType.type === 'object' && firstIteration) {
                    const innerObject = typedSchema.def.innerType as z.ZodObject
                    const [objectDef, objectType, deps] = this.expandZodObjectInline(innerObject, routerName, procedureName)
                    return [`${objectDef}.optional()`, `z.ZodOptional<${objectType}>`, deps]
                }

                const [innerType, innerTypeName, innerDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema.def.innerType,
                    routerName,
                    procedureName
                )
                return [`${innerType}.optional()`, `z.ZodOptional<${innerTypeName}>`, innerDependencies]
            }
            case 'nullable': {
                const typedSchema = schema as z.ZodNullable<ZodTypeAny>

                if (typedSchema.def.innerType.def.type === 'object') {
                    const innerObject = typedSchema.def.innerType as z.ZodObject
                    if (firstIteration) {
                        const [objectDef, objectType, deps] = this.expandZodObjectInline(innerObject, routerName, procedureName)
                        return [`${objectDef}.nullable()`, `z.ZodNullable<${objectType}>`, deps]
                    }
                }

                const [innerType, innerTypeName, innerDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema.def.innerType,
                    routerName,
                    procedureName
                )
                return [`${innerType}.nullable()`, `z.ZodNullable<${innerTypeName}>`, innerDependencies]
            }
            case 'enum': {
                const typedSchema = schema as z.ZodEnum
                const schemaValues = typedSchema.options.map((v) => `"${v}"`).join(', ')
                const typeValues = typedSchema.options.map((v) => `${v}: "${v}"`).join(', ')
                return [`z.enum([${schemaValues}])`, `z.ZodEnum<{ ${typeValues} }>`, []]
            }
            case 'union': {
                const typedSchema = schema as z.ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>
                const definitions = typedSchema.def.options
                    .map((opt: ZodTypeAny) => this.getZodDefinitionStringIterative(opt, routerName, procedureName)[0])
                    .join(', ')
                const definitionTypes = typedSchema.def.options
                    .map((opt: ZodTypeAny) => {
                        const typeName = this.getZodDefinitionStringIterative(opt, routerName, procedureName)[1]
                        return typeName
                    })
                    .join(', ')
                const dependencies = typedSchema.def.options
                    .map((opt: ZodTypeAny) => {
                        const dependencies = this.getZodDefinitionStringIterative(opt, routerName, procedureName)[2]
                        return dependencies
                    })
                    .flat()
                return [`z.union([${definitions}])`, `z.ZodUnion<[${definitionTypes}]>`, dependencies]
            }
            case 'intersection': {
                const typedSchema = schema as z.ZodIntersection<ZodTypeAny, ZodTypeAny>
                const [leftType, leftTypeName, leftDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema.def.left,
                    routerName,
                    procedureName
                )
                const [rightType, rightTypeName, rightDependencies] = this.getZodDefinitionStringIterative(
                    typedSchema.def.right,
                    routerName,
                    procedureName
                )
                return [
                    `z.intersection(${leftType}, ${rightType})`,
                    `z.ZodIntersection<${leftTypeName}, ${rightTypeName}>`,
                    [...leftDependencies, ...rightDependencies],
                ]
            }
            case 'lazy': {
                const typedSchema = schema as z.ZodLazy<ZodTypeAny>
                try {
                    const innerSchema = typedSchema.def.getter?.()
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
                return [`z.lazy(() => z.unknown())`, 'z.ZodLazy<z.ZodUnknown>', []]
            }
            case 'record': {
                const typedSchema = schema as z.ZodRecord
                if (typedSchema.def.valueType) {
                    const [valueType, valueTypeName, valueDependencies] = this.getZodDefinitionStringIterative(
                        typedSchema.def.valueType as ZodTypeAny,
                        routerName,
                        procedureName
                    )
                    return [`z.record(${valueType})`, `z.ZodRecord<string, ${valueTypeName}>`, valueDependencies]
                }
                return [`z.record(z.unknown())`, 'z.ZodRecord<string, z.ZodUnknown>', []]
            }
            case 'tuple': {
                const typedSchema = schema as z.ZodTuple<[ZodTypeAny, ...ZodTypeAny[]]>
                if (typedSchema.def.items) {
                    const definitions = typedSchema.def.items
                        .map((item: ZodTypeAny) => this.getZodDefinitionStringIterative(item, routerName, procedureName)[0])
                        .join(', ')
                    const definitionTypes = typedSchema.def.items
                        .map((item: ZodTypeAny) => this.getZodDefinitionStringIterative(item, routerName, procedureName)[1])
                        .join(', ')
                    const dependencies = typedSchema.def.items
                        .map((item: ZodTypeAny) => this.getZodDefinitionStringIterative(item, routerName, procedureName)[2])
                        .flat()
                    return [`z.tuple([${definitions}])`, `z.ZodTuple<[${definitionTypes}]>`, dependencies]
                }
                return [`z.tuple([])`, 'z.ZodTuple<[]>[]', []]
            }
            case 'literal': {
                const typedSchema = schema as z.ZodLiteral
                const values = typedSchema.def.values
                if (Array.isArray(values) && values.length > 0) {
                    if (values.length === 1) {
                        // Single literal
                        const value = values[0]
                        if (typeof value === 'string') {
                            return [`z.literal("${value}")`, `z.ZodLiteral<"${value}">`, []]
                        } else if (typeof value === 'number' || typeof value === 'boolean') {
                            return [`z.literal(${value})`, `z.ZodLiteral<${value}>`, []]
                        } else if (typeof value === 'bigint') {
                            return [`z.literal(${value}n)`, `z.ZodLiteral<${value}n>`, []]
                        } else if (value === null) {
                            return [`z.literal(null)`, `z.ZodLiteral<null>`, []]
                        } else if (value === undefined) {
                            return [`z.literal(undefined)`, `z.ZodLiteral<undefined>`, []]
                        }
                        return [`z.literal(${JSON.stringify(value)})`, `z.ZodLiteral<${JSON.stringify(value)}>`, []]
                    } else {
                        // Multiple literals - create union
                        const literalDefs = values.map((value) => {
                            if (typeof value === 'string') {
                                return `z.literal("${value}")`
                            } else if (typeof value === 'number' || typeof value === 'boolean') {
                                return `z.literal(${value})`
                            } else if (typeof value === 'bigint') {
                                return `z.literal(${value}n)`
                            } else if (value === null) {
                                return `z.literal(null)`
                            } else if (value === undefined) {
                                return `z.literal(undefined)`
                            }
                            return `z.literal(${JSON.stringify(value)})`
                        })
                        const literalTypes = values.map((value) => {
                            if (typeof value === 'string') {
                                return `z.ZodLiteral<"${value}">`
                            } else if (typeof value === 'number' || typeof value === 'boolean') {
                                return `z.ZodLiteral<${value}>`
                            } else if (typeof value === 'bigint') {
                                return `z.ZodLiteral<${value}n>`
                            } else if (value === null) {
                                return `z.ZodLiteral<null>`
                            } else if (value === undefined) {
                                return `z.ZodLiteral<undefined>`
                            }
                            return `z.ZodLiteral<${JSON.stringify(value)}>`
                        })
                        return [`z.union([${literalDefs.join(', ')}])`, `z.ZodUnion<[${literalTypes.join(', ')}]>`, []]
                    }
                }
                return [`z.literal(null)`, `z.ZodLiteral<null>`, []]
            }
            default:
                console.warn(`Unknown schema type: ${typeName}`)
                return ['z.unknown()', 'z.ZodUnknown', []]
        }
    }

    private generateNestedSchemaNameSafe(schema: z.ZodObject): string {
        if (this.schemaNameCache.has(schema)) {
            return this.schemaNameCache.get(schema)!
        }

        const description = schema.description
        if (description) {
            const isNameValid = /^[a-zA-Z0-9_]+$/.test(description) && description.length > 0
            if (isNameValid) {
                this.schemaNameCache.set(schema, description)
                return description
            }
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

    public generateNestedSchemaNameSafeForRouter(schema: z.ZodObject): string {
        if (this.schemaNameCache.has(schema)) {
            return this.schemaNameCache.get(schema)!
        }

        const description = schema.description
        if (description) {
            this.schemaNameCache.set(schema, description)
            return description
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

    private createSchemaHashSafe(schema: z.ZodObject): string {
        if (this.schemaHashCache.has(schema)) {
            return this.schemaHashCache.get(schema)!
        }

        try {
            const typeName = schema.def.type || 'unknown'
            let hashInput = typeName.toString()

            try {
                const shape = schema.def.shape
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
