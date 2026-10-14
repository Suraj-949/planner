// Project helpers.
//
// A project's colour is optional in the schema — there is no default, because any colour
// we invented would quietly become "the colour of every project created this month". The
// palette is what the form offers, and the fallback below is what a colourless project
// renders as, not a colour it is assigned.

export const PROJECT_COLOURS = [
    '#4f46e5',
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#64748b',
]

export const PROJECT_COLOUR_FALLBACK = '#64748b'

export const PROJECT_COLOUR = /^#[0-9a-fA-F]{6}$/
