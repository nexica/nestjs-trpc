import { useEffect, useState, useMemo } from 'react'
import { compileMdx } from 'nextra/compile'
import useSWR from 'swr'

export interface Author {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    received_events_url: string
    type: string
    user_view_type: string
    site_admin: boolean
}

export interface Release {
    url: string
    assets_url: string
    upload_url: string
    html_url: string
    id: number
    author: Author
    node_id: string
    tag_name: string
    target_commitish: string
    name: string
    draft: boolean
    prerelease: boolean
    created_at: string
    published_at: string
    assets: unknown[]
    tarball_url: string
    zipball_url: string
    body: string
    isCompiled?: boolean // Track whether MDX compilation is complete
}

export interface TOC {
    value: string
    depth: string
    id: string
}

// Cache for compiled MDX to avoid recompilation
const mdxCache = new Map<string, string>()

// Load cached MDX from localStorage on initialization
const loadCacheFromStorage = () => {
    if (typeof window === 'undefined') return

    try {
        const cached = localStorage.getItem('nestjs-trpc-release-notes-cache')
        if (cached) {
            const parsedCache = JSON.parse(cached)
            Object.entries(parsedCache).forEach(([key, value]) => {
                mdxCache.set(key, value as string)
            })
        }
    } catch (error) {
        console.warn('Failed to load release notes cache from localStorage:', error)
    }
}

// Save cache to localStorage
const saveCacheToStorage = () => {
    if (typeof window === 'undefined') return

    try {
        const cacheObject = Object.fromEntries(mdxCache.entries())
        localStorage.setItem('nestjs-trpc-release-notes-cache', JSON.stringify(cacheObject))
    } catch (error) {
        console.warn('Failed to save release notes cache to localStorage:', error)
    }
}

// Initialize cache from localStorage
loadCacheFromStorage()

export function useReleaseNotes() {
    const fetcher = (url: string) =>
        fetch(url, {
            headers: {
                Accept: 'application/vnd.github+json',
            },
        }).then((res) => res.json())

    const [compiledReleases, setCompiledReleases] = useState<Release[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isCompiling, setIsCompiling] = useState(false)

    const { data, error: swrError, isLoading } = useSWR<Release[]>('https://api.github.com/repos/nexica/nestjs-trpc/releases?per_page=10', fetcher)

    // Memoize the formatted releases without MDX compilation
    const formattedReleases = useMemo(() => {
        if (!data || data.length === 0) return []

        return data.map((release) => ({
            ...release,
            created_at: new Date(release.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
            body: release.body, // Keep original body for compilation
            isCompiled: false, // Track compilation status
        }))
    }, [data])

    // Don't show anything until compilation is complete
    useEffect(() => {
        if (!formattedReleases.length || isLoading || error) return

        if (data?.toString() === 'rate limit exceeded') {
            setError('Rate limit exceeded. Please try again later. Or check your API key.')
            return
        }

        const compileReleasesAsync = async () => {
            setIsCompiling(true)

            try {
                // Check cache first, then compile only uncached releases
                const releasesWithCompiledMdx = await Promise.all(
                    formattedReleases.map(async (release) => {
                        const cacheKey = `${release.id}-${release.tag_name}`

                        if (mdxCache.has(cacheKey)) {
                            return {
                                ...release,
                                body: mdxCache.get(cacheKey)!,
                                isCompiled: true,
                            }
                        }

                        // Only compile if not in cache
                        const compiledBody = await compileMdx(release.body)
                        mdxCache.set(cacheKey, compiledBody)
                        saveCacheToStorage() // Save to localStorage after successful compilation

                        return {
                            ...release,
                            body: compiledBody,
                            isCompiled: true,
                        }
                    })
                )

                setCompiledReleases(releasesWithCompiledMdx)
            } catch (compileError) {
                console.error('Error compiling release notes:', compileError)
                setError('Failed to compile release notes')
            } finally {
                setIsCompiling(false)
            }
        }

        // Use requestIdleCallback for non-blocking compilation
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(() => {
                compileReleasesAsync()
            })
        } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(compileReleasesAsync, 0)
        }
    }, [formattedReleases, isLoading, error, data])

    // Show loading until we have compiled releases
    const hasCompiledContent = compiledReleases.length > 0 && compiledReleases.every((r) => r.isCompiled)
    const finalIsLoading = isLoading || isCompiling || !hasCompiledContent

    return {
        data: compiledReleases,
        error: error || swrError,
        isLoading: finalIsLoading,
        isCompiling,
    } as const
}
