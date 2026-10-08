export const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
export const money = formatCurrency
export const signedMoney = value => `${Number(value) < 0 ? '-' : Number(value) > 0 ? '+' : ''} ${formatCurrency(Math.abs(Number(value) || 0))}`.trim()
export const errorText = error => error?.message || 'Não foi possível concluir a operação.'
export const optionalCategoryId = value => typeof value === 'string' ? (value.trim() ? value : null) : (value ?? null)
export const parseAmount = value => { const normalized = String(value).trim().replace(',', '.'); if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN; return Number(normalized) }
export const formatDecimalInput = value => { const numeric = Number(value); return Number.isFinite(numeric) ? numeric.toFixed(2).replace('.', ',') : '' }
