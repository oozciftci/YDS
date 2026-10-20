import type { CardState } from '../types/database'

/** Bir kelime bu kadar ya da daha fazla unutulduysa "inatçı kelime" (leech) sayılır. */
export const LEECH_LAPSES = 5

export const isLeech = (card: Pick<CardState, 'lapses'> | undefined | null) => (card?.lapses ?? 0) >= LEECH_LAPSES
