import type { Metadata } from 'next'

import type { ReactNode } from 'react'

import { Footer, LastUpdated, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { CustomFooter } from '@/components/CustomFooter'
import ThemeToggle from '@/widgets/theme-toggle'

import { ThemeProvider } from './_components/ThemeProvider'
import './styles/index.css'

export const metadata = {
    // Define your metadata here
    // For more information on metadata API, see: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
    // metadataBase: new URL('https://nextjs-nextra-starter-green.vercel.app'),
    icons: '/img/favicon.svg',
} satisfies Metadata

const repo = 'https://github.com/nexica/nestjs-trpc'

const CustomBanner = async () => {
    return (
        <Banner storageKey="starter-banner">
            <div className="flex justify-center items-center gap-1">
                {'👋 Hey there! Welcome to NestJS tRPC. This documentation is a work in progress. Please report any issues or suggestions to the'}{' '}
                <a className="max-sm:hidden text-warning underline" target="_blank" rel="noreferrer" href={repo}>
                    {'github repository.'}
                </a>
            </div>
        </Banner>
    )
}

const CustomNavbar = async () => {
    return (
        <Navbar logo={<span>🚀 NestJS tRPC</span>} logoLink={`/`} projectLink={repo}>
            <ThemeToggle className="max-md:hidden" />
        </Navbar>
    )
}

interface Props {
    children: ReactNode
}

export default async function RootLayout({ children }: Props) {
    const pageMap = await getPageMap()

    const title = 'NestJS tRPC'
    const description = 'A Type-Safe API Bridge for NestJS and tRPC'

    return (
        <html lang="en" dir="ltr" suppressHydrationWarning>
            <Head
            // ... Your additional head options
            >
                {/* <title>{asPath !== '/' ? `${normalizePagesResult.title} - ${title}` : title}</title> */}
                <meta property="og:title" content={title} />
                <meta name="description" content={description} />
                <meta property="og:description" content={description} />
                <link rel="canonical" href={repo} />
            </Head>
            <body>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="nestjs-trpc-theme-provider" disableTransitionOnChange>
                    <Layout
                        banner={<CustomBanner />}
                        navbar={<CustomNavbar />}
                        lastUpdated={<LastUpdated>Last updated on:</LastUpdated>}
                        editLink={null}
                        docsRepositoryBase="https://github.com/nexica/nestjs-trpc"
                        footer={
                            <Footer className="bg-background py-5!">
                                <CustomFooter />
                            </Footer>
                        }
                        search={<Search />}
                        pageMap={pageMap}
                        feedback={{ content: '' }}
                        // ... Your additional layout options
                    >
                        {children}
                    </Layout>
                </ThemeProvider>
            </body>
        </html>
    )
}
