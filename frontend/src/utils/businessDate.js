const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

export function businessDate(value) {
  const candidate = String(value || '').slice(0, 10)
  if (isoDatePattern.test(candidate)) return candidate
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const businessToday = () => businessDate()

export function businessMonth(value) {
  return businessDate(value).slice(0, 7)
}

export function addBusinessMonths(month, amount) {
  const [year, monthNumber] = businessMonth(month).split('-').map(Number)
  const result = new Date(year, monthNumber - 1 + amount, 1)
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}`
}
