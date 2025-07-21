'use client'

import clsx from 'clsx'
import Link from 'next/link'
import styles from '@/components/HomepageHero/SetupHero.module.css'
import { MotionWrapperFlash } from '@/components/MotionWrapper/Flash'
import { Button } from '@/components/ui/button'
import { FlipWords } from '@/components/ui/flip-words'
import { LinkPreview } from '@/components/ui/link-preview'

export function SetupHero() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.badgeContainer}>
                    <a className={styles.badge} href="https://github.com/nexica/nestjs-trpc" target="_blank" rel="noopener noreferrer">
                        Type-Safe API Bridge 🚀
                    </a>
                </div>
                <h1 className={styles.headline}>
                    <MotionWrapperFlash disabledAnimation={false} className="flex items-center">
                        <span className="icon-[emojione-v1--lightning-mood]"></span>
                    </MotionWrapperFlash>{' '}
                    NestJS <br className="sm:hidden"></br> tRPC
                    <br className="sm:hidden"></br> Bridge
                </h1>

                <Link
                    href="/docs"
                    className={clsx([
                        'bg-linear-to-r from-blue-400 via-purple-500 to-indigo-500 text-white shadow-lg',
                        'dark:bg-linear-to-r dark:from-blue-400 dark:via-purple-500 dark:to-indigo-500 dark:text-white',
                        'text-sm mt-2 inline-block px-3 py-1 rounded-lg',
                        '[&>span]:font-bold',
                        'animate-pulse',
                        '[animation-duration:2s]',
                    ])}
                    dangerouslySetInnerHTML={{
                        __html: '⚡ Build <span>type-safe APIs</span> with ease!',
                    }}
                />

                <div className={clsx([styles.subtitle, 'text-neutral-500 dark:text-neutral-300'])}>
                    Bridge NestJS and tRPC for{' '}
                    <FlipWords
                        words={['Type-Safe', 'Scalable', 'Modern', 'Efficient', 'Developer-Friendly', 'Powerful', 'Seamless', 'Robust', 'Fast']}
                    />
                    <br />
                    API development with <LinkPreview url="https://nestjs.com">NestJS</LinkPreview>,{' '}
                    <LinkPreview url="https://trpc.io">tRPC</LinkPreview>, and <LinkPreview url="https://zod.dev">Zod</LinkPreview>
                    {', '}
                    <LinkPreview url="https://www.typescriptlang.org">TypeScript</LinkPreview>
                </div>
                <div className="flex justify-center pt-10">
                    <div className="max-w-[500px] flex flex-wrap gap-[20px] max-sm:justify-center">
                        <Button asChild size="lg" className="font-bold group max-sm:w-[100%]">
                            <Link href="/docs">
                                Get Started
                                <span className="w-[20px] translate-x-[6px] transition-all group-hover:translate-x-[10px] icon-[mingcute--arrow-right-fill]"></span>
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="secondary" className="font-bold group max-sm:w-[100%]">
                            <Link href="https://github.com/nexica/nestjs-trpc" target="_blank">
                                GitHub
                                <span className="ml-[6px] icon-[mingcute--github-line]"></span>
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
