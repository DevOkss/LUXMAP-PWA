export function isStudentRequired(
  requiredYears: string[] | undefined,
  yearLevel: number | null | undefined,
): boolean {
  if (!requiredYears || !requiredYears.length) return false
  if (requiredYears.includes('all')) return true
  if (!yearLevel) return false
  return requiredYears.includes(String(yearLevel))
}

export function requiredYearsLabel(requiredYears: string[] | undefined): string {
  if (!requiredYears || !requiredYears.length) return ''
  if (requiredYears.includes('all')) return 'All students required'
  const sorted = [...requiredYears].sort((a, b) => Number(a) - Number(b))
  const years = sorted.map(y => `${y}${getOrdinal(y)}`).join(', ')
  return `${years} Year${sorted.length > 1 ? 's' : ''} required`
}

function getOrdinal(n: string): string {
  const num = parseInt(n, 10)
  if (num % 100 >= 11 && num % 100 <= 13) return 'th'
  if (num % 10 === 1) return 'st'
  if (num % 10 === 2) return 'nd'
  if (num % 10 === 3) return 'rd'
  return 'th'
}
