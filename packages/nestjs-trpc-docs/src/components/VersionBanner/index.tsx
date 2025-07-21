'use client'
import React, { useEffect, useState } from 'react'

const GITHUB_API = 'https://api.github.com/repos/nexica/nestjs-trpc/releases/latest'

export function VersionBanner() {
    const [version, setVersion] = useState<string | null>(null)

    useEffect(() => {
        fetch(GITHUB_API)
            .then((res) => res.json())
            .then((data) => setVersion(data.tag_name))
            .catch(() => setVersion(null))
    }, [])

    return (
        <div className="flex justify-center items-center gap-1">{`👋 Hey there! Welcome to NestJS tRPC. ${version ? `🎉 We've just released v${version}!` : ''}`}</div>
    )
}
