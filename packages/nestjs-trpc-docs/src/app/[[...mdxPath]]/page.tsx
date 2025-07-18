import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents } from '@/mdx-components'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

export async function generateMetadata(props: PageProps) {
    const params = await props.params
    const { metadata } = await importPage(params.mdxPath)
    return metadata
}

type PageProps = Readonly<{
    params: Promise<{
        mdxPath: string[]
    }>
}>

function MDXWrapper({ children, toc, metadata }: { children: React.ReactNode; toc: unknown; metadata: unknown }) {
    const Wrapper = useMDXComponents().wrapper
    return (
        <Wrapper toc={toc} metadata={metadata}>
            {children}
        </Wrapper>
    )
}

export default async function Page(props: PageProps) {
    const params = await props.params
    const result = await importPage(params.mdxPath)
    const { default: MDXContent, toc, metadata } = result

    return (
        <MDXWrapper toc={toc} metadata={metadata}>
            <MDXContent {...props} params={params} />
        </MDXWrapper>
    )
}
