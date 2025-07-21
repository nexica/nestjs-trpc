import type { MetaRecord } from 'nextra'

const meta: MetaRecord = {
    index: {
        title: 'Home',
        type: 'page',
        theme: {
            layout: 'full',
        },
        display: 'hidden',
    },
    docs: {
        title: 'Documentation',
        type: 'page',
        theme: {
            layout: 'full',
        },
    },
} satisfies MetaRecord

export default meta
