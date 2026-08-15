const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Posted',
  completed: 'Completed',
}

export function eventStatusLabel(status: string): string {
  return EVENT_STATUS_LABELS[status] || status
}
