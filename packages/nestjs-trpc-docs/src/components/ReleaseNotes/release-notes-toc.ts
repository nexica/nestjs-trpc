import type { Release, TOC } from './use-release-notes'

export async function releaseNotesToc() {
    const fetcher = (url: string, options?: RequestInit) => fetch(url, options).then((res) => res.json())

    try {
        const releases = await fetcher(
            `https://api.github.com/repos/nexica/nestjs-trpc/releases?per_page=100`
            // {
            //   headers: {
            //     Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            //   },
            // }
        ).catch((error) => {
            console.error('Error fetching releases:', error)
            throw error
        })

        if (Array.isArray(releases) === false) {
            console.error('Invalid response format:', releases)
            return '[]'
        }

        const toc: TOC[] = releases
            .filter((release: Release) => !release.prerelease)
            .slice(0, 10)
            .map((release: Release) => ({
                value: `${release.tag_name} - ${new Date(release.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', ', ')}`,
                depth: '3',
                id: release.tag_name,
            }))
        return toc
    } catch (error) {
        console.error('Error fetching release notes:', error)
        return JSON.stringify(error)
    }
}
