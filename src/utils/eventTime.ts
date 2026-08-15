import type { Event } from '@/types'

export type EventStatus = 'upcoming' | 'ongoing' | 'done' | 'completed'

export function parseEventDate(raw: string): { y: number; m: number; d: number } {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return { y: NaN, m: NaN, d: NaN }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

export function makeEventDateTime(eventDate: string, time: string | null): Date {
  const { y, m, d } = parseEventDate(eventDate)
  const [h = 0, min = 0] = (time || '').split(':').map(Number)
  return new Date(y, m - 1, d, h || 0, min || 0)
}

function endOfEventDay(eventDate: string): Date {
  const { y, m, d } = parseEventDate(eventDate)
  return new Date(y, m - 1, d + 1, 0, 0, 0)
}

export function isEventNotStarted(eventDate: string, timeFrom: string | null, now: Date = new Date()): boolean {
  if (!timeFrom) return false
  return now < makeEventDateTime(eventDate, timeFrom)
}

export function isEventEnded(eventDate: string, timeTo: string | null, now: Date = new Date()): boolean {
  return now >= (timeTo ? makeEventDateTime(eventDate, timeTo) : endOfEventDay(eventDate))
}

export function getEventStatus(
  evt: Pick<Event, 'status' | 'event_date' | 'time_from' | 'time_to'>,
  now: Date = new Date()
): EventStatus {
  if (evt.status === 'completed') return 'completed'
  if (evt.status === 'draft') return 'upcoming'

  const start = makeEventDateTime(evt.event_date, evt.time_from)
  const end = evt.time_to ? makeEventDateTime(evt.event_date, evt.time_to) : endOfEventDay(evt.event_date)

  if (now >= end) return 'done'
  if (now >= start) return 'ongoing'
  return 'upcoming'
}
