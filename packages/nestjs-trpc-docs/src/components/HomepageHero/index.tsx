'use client'

import { useMemo } from 'react'
import Marquee from 'react-fast-marquee'
import { PanelParticles } from '@/components/PanelParticles'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { HoverEffect } from '@/components/ui/card-hover-effect'

import { cn } from '@/lib/utils'
import { Section } from './Section'
import { SetupHero } from './Setup'

export const StackItem = ({ className }: { className: string }) => {
    return (
        <div
            className={cn(
                'mx-6 size-[50px]',
                'text-neutral-800 dark:text-neutral-100',
                'transition-all duration-300 transform opacity-75',
                'hover:scale-125 hover:opacity-100',
                className
            )}
        ></div>
    )
}

export default function HomepageHero() {
    const faqs = [
        {
            question: 'What is NestJS tRPC and why should I use it?',
            answer: "NestJS tRPC is a TypeScript integration package that bridges NestJS and tRPC, enabling fully type-safe API development. It allows you to leverage NestJS's powerful features like dependency injection and modules while getting tRPC's end-to-end type safety.",
        },
        {
            question: 'How does automatic schema generation work?',
            answer: 'The package automatically generates tRPC server definition files from your NestJS decorators. Set TRPC_SCHEMA_GENERATION=true and run your app to generate schemas, or use watch mode for live updates during development.',
        },
        {
            question: 'Can I use this with my existing NestJS application?',
            answer: 'Yes! NestJS tRPC is designed to integrate seamlessly with existing NestJS applications. You can gradually adopt it by adding tRPC decorators to your controllers and services.',
        },
        {
            question: 'What HTTP frameworks are supported?',
            answer: 'Currently supports Express (stable) and Fastify (experimental). The package provides drivers for both, allowing you to choose your preferred HTTP framework.',
        },
        {
            question: 'How do real-time subscriptions work?',
            answer: 'Subscriptions are supported through WebSocket connections. Configure WebSocket options in your TRPCModule and use the @Subscription decorator to create real-time endpoints with AsyncIterable generators.',
        },
        {
            question: 'Do I need to define schemas manually?',
            answer: "No! That's the main benefit - you define your input/output schemas using Zod in your decorators, and the package automatically generates the tRPC router definitions for type safety.",
        },
        {
            question: 'How do I get help or report issues?',
            answer: 'Visit our GitHub repository at nexica/nestjs-trpc to report issues, request features, or contribute to the project.',
        },
    ]

    const processedFeatureList = useMemo(() => {
        const featureList = [
            {
                title: 'Automatic Schema Generation',
                description: 'Generate tRPC schema files automatically from NestJS decorators (tRPC v11). No more manual schema definitions.',
            },
            {
                title: 'End-to-End Type Safety',
                description: "Build fully type-safe APIs with NestJS as your backend framework while getting tRPC's complete type safety.",
            },
            {
                title: 'NestJS Decorators',
                description: 'Use familiar decorator patterns for defining tRPC routers, queries, mutations, subscriptions, and middleware.',
            },
            {
                title: 'Real-time Subscriptions',
                description: 'Built-in WebSocket support for real-time subscriptions with automatic connection management.',
            },
            {
                title: 'Multiple Drivers',
                description: 'Support for Express and Fastify adapters, allowing you to choose your preferred HTTP framework.',
            },
            {
                title: 'Zod Integration',
                description: 'Seamlessly integrated with Zod for robust input validation and schema generation.',
            },
            {
                title: 'Watch Mode Development',
                description: 'Live schema regeneration during development - automatically updates your frontend types when you change decorators.',
            },
            {
                title: 'Dependency Injection',
                description: "Leverage NestJS's powerful dependency injection system while maintaining tRPC's type safety guarantees.",
            },
            {
                title: 'Middleware Support',
                description: 'Apply authentication, logging, and other middleware to tRPC procedures using NestJS patterns.',
            },
        ]

        const icons = [
            'icon-[material-symbols--auto-awesome-outline]',
            'icon-[material-symbols--security]',
            'icon-[material-symbols--code]',
            'icon-[material-symbols--subscriptions-outline]',
            'icon-[mingcute--route-line]',
            'icon-[simple-icons--zod]',
            'icon-[material-symbols--update]',
            'icon-[mingcute--plugin-line]',
            'icon-[material-symbols--layers]',
        ]
        return featureList.map((item, index) => {
            return {
                ...item,
                icon: <span className={icons[index] || icons[0]}></span>,
            }
        })
    }, [])

    return (
        <>
            <PanelParticles />
            <SetupHero />
            <div className="relative z-1 pb-10 md:pb-[100px]">
                <Section
                    title="Tech Stack"
                    titleProps={{
                        disabledAnimation: false,
                    }}
                >
                    <div className="flex justify-center w-full max-w-7xl h-[80px] my-[30px]">
                        <Marquee pauseOnHover autoFill gradient direction="right" gradientColor="var(--background)" speed={60}>
                            <StackItem className="icon-[simple-icons--nestjs]" />
                            <StackItem className="icon-[simple-icons--trpc]" />
                            <StackItem className="icon-[simple-icons--typescript]" />
                            <StackItem className="icon-[simple-icons--zod]" />
                            <StackItem className="icon-[simple-icons--express]" />
                            <StackItem className="icon-[simple-icons--fastify]" />
                            <StackItem className="icon-[mingcute--wifi-line]" />
                            <StackItem className="icon-[teenyicons--eslint-outline]" />
                            <StackItem className="icon-[simple-icons--nodedotjs]" />
                        </Marquee>
                    </div>
                </Section>
                <Section title="Features" description="Bridge NestJS and tRPC for type-safe, scalable API development.">
                    <div className="flex justify-center w-full max-w-7xl">
                        <HoverEffect items={processedFeatureList} />
                    </div>
                </Section>
                <Section title="Frequently Asked Questions" tallPaddingY>
                    <Accordion type="single" collapsible className="w-full max-w-5xl">
                        {faqs.map((faqItem, index) => (
                            <AccordionItem value={faqItem.question} key={index}>
                                <AccordionTrigger>{faqItem.question}</AccordionTrigger>
                                <AccordionContent>{faqItem.answer}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </Section>
            </div>
        </>
    )
}
