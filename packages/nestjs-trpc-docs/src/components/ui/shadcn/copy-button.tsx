'use client'

import * as React from 'react'
import { CheckIcon, ClipboardIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value)
}

export function CopyButton({
    value,
    className,
    variant = 'ghost',
    ...props
}: React.ComponentProps<typeof Button> & {
    value: string
    src?: string
}) {
    const [hasCopied, setHasCopied] = React.useState(false)

    React.useEffect(() => {
        if (hasCopied) {
            const timer = setTimeout(() => {
                setHasCopied(false)
            }, 2000)

            return () => clearTimeout(timer)
        }
    }, [hasCopied])

    const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget
        const codeBlock = button?.closest('figure')?.querySelector('code')

        let textToCopy = value

        if (codeBlock && (!value || !value.includes('\n'))) {
            textToCopy = codeBlock.textContent || value
        }

        copyToClipboard(textToCopy)
        setHasCopied(true)
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    data-slot="copy-button"
                    size="icon"
                    variant={variant}
                    className={cn('bg-code absolute top-2 right-2 z-10 size-8 hover:opacity-100 focus-visible:opacity-100', className)}
                    onClick={handleCopy}
                    {...props}
                >
                    <span className="sr-only">Copy</span>
                    {hasCopied ? <CheckIcon className="size-5" /> : <ClipboardIcon className="size-5" />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{hasCopied ? 'Copied' : 'Copy to Clipboard'}</TooltipContent>
        </Tooltip>
    )
}
