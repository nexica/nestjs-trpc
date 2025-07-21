import createWithNextra from 'nextra'

const withNextra = createWithNextra({
    defaultShowCopyCode: true,
    mdxOptions: {
        rehypePrettyCodeOptions: {
            theme: {
                dark: 'github-dark',
                light: 'github-light',
            },
            transformers: [
                {
                    code(node) {
                        if (node.tagName === 'code') {
                            const raw = this.source
                            node.properties['__raw__'] = raw

                            if (raw.startsWith('npm install')) {
                                node.properties['__npm__'] = raw
                                node.properties['__yarn__'] = raw.replace('npm install', 'yarn add')
                                node.properties['__pnpm__'] = raw.replace('npm install', 'pnpm add')
                                node.properties['__bun__'] = raw.replace('npm install', 'bun add')
                            }

                            if (raw.startsWith('npx create-')) {
                                node.properties['__npm__'] = raw
                                node.properties['__yarn__'] = raw.replace('npx create-', 'yarn create ')
                                node.properties['__pnpm__'] = raw.replace('npx create-', 'pnpm create ')
                                node.properties['__bun__'] = raw.replace('npx', 'bunx --bun')
                            }

                            // npm create.
                            if (raw.startsWith('npm create')) {
                                node.properties['__npm__'] = raw
                                node.properties['__yarn__'] = raw.replace('npm create', 'yarn create')
                                node.properties['__pnpm__'] = raw.replace('npm create', 'pnpm create')
                                node.properties['__bun__'] = raw.replace('npm create', 'bun create')
                            }

                            // npx.
                            if (raw.startsWith('npx')) {
                                node.properties['__npm__'] = raw
                                node.properties['__yarn__'] = raw.replace('npx', 'yarn')
                                node.properties['__pnpm__'] = raw.replace('npx', 'pnpm dlx')
                                node.properties['__bun__'] = raw.replace('npx', 'bunx --bun')
                            }

                            // npm run.
                            if (raw.startsWith('npm run')) {
                                node.properties['__npm__'] = raw
                                node.properties['__yarn__'] = raw.replace('npm run', 'yarn')
                                node.properties['__pnpm__'] = raw.replace('npm run', 'pnpm')
                                node.properties['__bun__'] = raw.replace('npm run', 'bun')
                            }
                        }
                    },
                },
                {
                    root(node: any) {
                        // Wrap code blocks in figure elements
                        function visit(node: any, parent: any = null, index: number | null = null) {
                            if (node.type === 'element' && node.tagName === 'pre') {
                                const codeElement = node.children?.find((child: any) => child.type === 'element' && child.tagName === 'code')

                                if (codeElement && parent && typeof index === 'number') {
                                    // Extract language from class names
                                    const className = codeElement.properties?.className || []
                                    const languageClass = Array.isArray(className)
                                        ? className.find((cls) => typeof cls === 'string' && cls.startsWith('language-'))
                                        : typeof className === 'string' && className.startsWith('language-')
                                          ? className
                                          : null

                                    const language = languageClass ? languageClass.replace('language-', '') : null

                                    // Create figure wrapper
                                    const figureNode = {
                                        type: 'element',
                                        tagName: 'figure',
                                        properties: {
                                            'data-rehype-pretty-code-figure': '',
                                        },
                                        children: [],
                                    }

                                    // Create figcaption if there's a language
                                    if (language && language !== 'text' && language !== 'plain') {
                                        const figcaptionNode = {
                                            type: 'element',
                                            tagName: 'figcaption',
                                            properties: {
                                                'data-rehype-pretty-code-title': '',
                                                'data-language': language,
                                            },
                                            children: [
                                                {
                                                    type: 'text',
                                                    value: language,
                                                },
                                            ],
                                        }
                                        ;(figureNode.children as any[]).push(figcaptionNode)
                                    }

                                    ;(figureNode.children as any[]).push(node)
                                    parent.children[index] = figureNode
                                    return figureNode
                                }
                            }

                            if (node.children) {
                                node.children.forEach((child: any, i: number) => visit(child, node, i))
                            }
                        }

                        visit(node)
                        return node
                    },
                    pre(node) {
                        node.properties['class'] =
                            'no-scrollbar min-w-0 overflow-x-auto px-4 py-3.5 outline-none has-[[data-highlighted-line]]:px-0 has-[[data-line-numbers]]:px-0 has-[[data-slot=tabs]]:p-0 !bg-transparent'
                    },
                    code(node) {
                        node.properties['data-line-numbers'] = ''
                    },
                    line(node) {
                        node.properties['data-line'] = ''
                    },
                },
            ],
            // keepBackground: false,
            // onVisitLine(node: any) {
            //     // Prevent lines from collapsing in `display: grid` mode, and allow empty
            //     // lines to be copy/pasted
            //     if (node.children.length === 0) {
            //         node.children = [{ type: 'text', value: ' ' }]
            //     }
            // },
            // onVisitHighlightedLine(node: any) {
            //     node.properties.className = ['line--highlighted']
            // },
            // onVisitHighlightedChars(node: any) {
            //     node.properties.className = ['word--highlighted']
            // },
        },
    },
})

const isProd = process.env.NODE_ENV === 'production'
const repo = '/nestjs-trpc'

/**
 * @type {import("next").NextConfig}
 */
export default withNextra({
    output: 'export',
    images: {
        unoptimized: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    reactStrictMode: true,
    cleanDistDir: true,
    sassOptions: {
        silenceDeprecations: ['legacy-js-api'],
    },
    basePath: isProd ? repo : '',
    assetPrefix: isProd ? repo + '/' : '',
    trailingSlash: true,
})
