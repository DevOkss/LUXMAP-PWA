const TENS: string[] = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const ONES: string[] = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  let out = ''
  if (hundreds) out += `${ONES[hundreds]} Hundred`
  if (rest) out += `${out ? ' ' : ''}${twoDigits(rest)}`
  return out
}

export function numberToWords(value: number): string {
  const amount = Math.round(value * 100)
  const whole = Math.floor(amount / 100)
  const cents = amount % 100
  let out = ''
  const billion = Math.floor(whole / 1000000000)
  const million = Math.floor((whole % 1000000000) / 1000000)
  const thousand = Math.floor((whole % 1000000) / 1000)
  const remainder = whole % 1000
  if (billion) out += `${threeDigits(billion)} Billion `
  if (million) out += `${threeDigits(million)} Million `
  if (thousand) out += `${threeDigits(thousand)} Thousand `
  if (remainder) out += threeDigits(remainder)
  out = out.trim() || 'Zero'
  const pesoWord = whole === 1 ? 'Peso' : 'Pesos'
  out += ` ${pesoWord}`
  if (cents > 0) {
    const centWord = cents === 1 ? 'Centavo' : 'Centavos'
    out += ` and ${twoDigits(cents)} ${centWord}`
  }
  return out
}
