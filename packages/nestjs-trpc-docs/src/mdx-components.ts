import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import { Pre, withIcons } from 'nextra/components'
import { GitHubIcon } from 'nextra/icons'
import { shadcnMDXComponents } from './shadcn-mdx-components'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomWrapper = (props: any) => {
    const components = getDocsMDXComponents()
    const DefaultWrapper = components.wrapper

    // Check if this is the homepage/index route
    const isHomepage =
        props.metadata?.filePath === 'index.mdx' ||
        props.metadata?.route === '/' ||
        props.metadata?.title === 'NestJS tRPC - Type-Safe APIs Made Easy'

    if (isHomepage) {
        // For homepage, render without content constraints
        return props.children
    }

    // For other pages, use default Nextra wrapper
    return DefaultWrapper ? DefaultWrapper(props) : props.children
}

export const useMDXComponents = () => {
    const docsComponents = getDocsMDXComponents({
        pre: withIcons(Pre, { js: GitHubIcon }),
    })
    const shadcnComponents = shadcnMDXComponents
    const customComponents = {
        wrapper: CustomWrapper,
    }

    return {
        ...docsComponents,
        ...shadcnComponents,
        ...customComponents,
    }
}
