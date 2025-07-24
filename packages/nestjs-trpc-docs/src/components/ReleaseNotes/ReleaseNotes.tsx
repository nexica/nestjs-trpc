'use client'

import { MDXRemote } from 'nextra/mdx-remote'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useMDXComponents } from '@/mdx-components'
import { useReleaseNotes, type Release } from './use-release-notes'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function ReleaseNotes() {
    const { data, error, isLoading } = useReleaseNotes()

    const components = useMDXComponents()

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Failed to load releases</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    if (isLoading) {
        return (
            <div className="mt-12 w-full gap-4 flex flex-col">
                <p>Loading releases...</p>
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-5 w-full rounded-lg" />
            </div>
        )
    }

    if (!data || data.length === 0) {
        return null
    }

    return (
        <div className="mt-12 gap-4 flex flex-col" id="release-notes">
            {data.map((release: Release) => (
                <Card id={release.tag_name} key={release.id} className="p-4 rounded-lg shadow-sm x:tracking-tight x:target:animate-[fade-in_1.5s]">
                    <div className="flex justify-between">
                        <Badge variant="outline" className="text-md">
                            {release.tag_name}
                        </Badge>
                        <p>{release.created_at}</p>
                    </div>

                    <MDXRemote compiledSource={release.body} components={components} />
                </Card>
            ))}
            <Button asChild variant="default" className="rounded-lg">
                <Link href="https://github.com/nexica/nestjs-trpc/releases" target="_blank">
                    View full changelog on GitHub
                    <span className="ml-[6px] icon-[mingcute--github-line]"></span>
                </Link>
            </Button>
        </div>
    )
}
