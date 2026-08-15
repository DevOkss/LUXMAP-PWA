export type PaymentChannel = 'gcash' | 'maya' | 'bank_transfer' | 'other'

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
}

export function paymentChannelForProvider(
  provider?: string | null,
): PaymentChannel {
  const value = (provider || '').toLowerCase()
  if (value.includes('gcash')) return 'gcash'
  if (value.includes('maya')) return 'maya'
  if (value.includes('bank') || value.includes('transfer')) return 'bank_transfer'
  return 'other'
}

export function paymentChannelLabel(channel?: string | null): string {
  if (!channel) return ''
  if (channel === 'cashless') return 'Cashless'
  return CHANNEL_LABELS[channel as PaymentChannel] || channel
}