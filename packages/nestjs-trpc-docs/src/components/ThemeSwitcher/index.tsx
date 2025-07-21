'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'nextra-theme-docs'
import { Button } from '@/components/ui/button'

export const ThemeSwitcher = () => {
    const { setTheme } = useTheme()

    return (
        <div className="flex justify-start max-sm:justify-center gap-6 py-6">
            <div className="flex flex-col items-center gap-2">
                <Button variant="secondary" size="icon" onClick={() => setTheme('light')} aria-label="Switch to light mode">
                    <Sun className="h-[1.5rem] w-[1.5rem]" />
                </Button>
                <span className="text-sm text-muted-foreground">Light Mode</span>
            </div>

            <div className="flex flex-col items-center gap-2">
                <Button variant="secondary" size="icon" onClick={() => setTheme('dark')} aria-label="Switch to dark mode">
                    <Moon className="h-[1.5rem] w-[1.5rem]" />
                </Button>
                <span className="text-sm text-muted-foreground">Dark Mode</span>
            </div>
        </div>
    )
}
