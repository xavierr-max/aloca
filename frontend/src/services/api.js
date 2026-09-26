const API_URL = import.meta.env.VITE_API_URL || ''
const amountValue = value => Number(String(value).trim().replace(',', '.'))
const API_UNAVAILABLE_EVENT = 'aloca:api-unavailable'
const API_RECOVERED_EVENT = 'aloca:api-recovered'
export const isNetworkError = error => Boolean(error?.isNetworkError)
const notify = (name, detail) => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent(name, { detail }))
const networkError = (message, cause) => Object.assign(new Error(message), { isNetworkError: true, cause })
const inflight = new Map()
let requestSequence = 0
let accountContextVersion = 0

// GETs started before an account switch must never be reused for the new
// account. The server ignores this query parameter; it only partitions the
// client-side request deduplication cache by session context.
export const markAccountContextChanged = () => { accountContextVersion += 1 }
const accountScopedPath = path => {
  if (!path.startsWith('/api/') || path.startsWith('/api/account/')) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}__account_context=${accountContextVersion}`
}

async function performRequest(path, options = {}) {
  const method = options.method || 'GET'
  const dedupeKey = method === 'GET' ? `${method}:${path}` : null
  if (dedupeKey && inflight.has(dedupeKey)) return inflight.get(dedupeKey)
  const requestId = `aloca-${++requestSequence}`
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 12000)
  try {
    const { timeout: _timeout, signal, suppressAvailabilityEvent, ...fetchOptions } = options
    const headers = { ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-Request-Id': requestId, ...fetchOptions.headers }
    const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers, ...fetchOptions, signal: signal || controller.signal })
    const durationMs = Math.round(performance.now() - startedAt)
    if (import.meta.env.DEV) console.info('[aloca request]', { requestId, endpoint: path, method, durationMs, status: response.status })
    if (!response.ok) {
      let body = {}
      try { body = await response.json() } catch {}
      const validation = body.errors ? Object.values(body.errors).flat().join(' ') : ''
      const error = new Error(body.message || validation || body.detail || `Erro ${response.status} ao acessar a API.`)
      error.status = response.status
      error.validation = body.errors || {}
      throw error
    }
    if (response.status === 204) return null
    const contentType = response.headers.get('content-type') || ''
    return contentType.includes('json') ? response.json() : response.text()
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[aloca request error]', { requestId, endpoint: path, method, durationMs: Math.round(performance.now() - startedAt), aborted: error?.name === 'AbortError', error: error?.message })
    if (error?.status) throw error
    const unavailable = networkError(error?.name === 'AbortError' ? 'A API demorou para responder.' : 'Não foi possível conectar à API.', error)
    if (!suppressAvailabilityEvent) notify(API_UNAVAILABLE_EVENT, unavailable)
    throw unavailable
  } finally { clearTimeout(timeout); if (dedupeKey) inflight.delete(dedupeKey) }
}

function request(path, options = {}) {
  const method = options.method || 'GET'
  const requestPath = method === 'GET' ? accountScopedPath(path) : path
  const key = method === 'GET' ? `${method}:${requestPath}` : null
  if (!key) return performRequest(path, options)
  const existing = inflight.get(key)
  if (existing) return existing
  const promise = performRequest(requestPath, options)
  inflight.set(key, promise)
  return promise
}

export const apiAvailabilityEvents = { unavailable: API_UNAVAILABLE_EVENT, recovered: API_RECOVERED_EVENT }
export const api = {
  requestPasswordRecovery: email => request('/api/account/password-recovery/request', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password, confirmPassword) => request('/api/account/password-recovery/reset', { method: 'POST', body: JSON.stringify({ token, password, confirmPassword }) }),
  updateCurrentBalance: newBalance => request('/api/financial-settings/current-balance-adjustment', { method: 'POST', body: JSON.stringify({ newBalance: amountValue(newBalance) }) }),
  // Health is the only global availability signal. Resource failures stay local.
  health: async () => { try { const result = await request('/health', { timeout: 8000, suppressAvailabilityEvent: true }); notify(API_RECOVERED_EVENT); return result } catch (error) { throw error } },
  monthlySummary: month => {
    const match = /^(\d{4})-(\d{2})/.exec(String(month || ''))
    if (!match) throw new Error('O mês selecionado é inválido.')
    const normalizedMonth = `${match[1]}-${match[2]}`
    return request(`/api/financial-summary/monthly?period=${encodeURIComponent(`${normalizedMonth}-01`)}`)
  },
  account: () => request('/api/account/current'), continueLocal: () => request('/api/account/local/continue', { method: 'POST' }), createLocal: displayName => request('/api/account/local', { method: 'POST', body: JSON.stringify({ displayName: displayName || null }) }), login: (email, password) => request('/api/account/login', { method: 'POST', body: JSON.stringify({ email, password }) }), renameAccount: displayName => request('/api/account/rename', { method: 'PATCH', body: JSON.stringify({ displayName }) }), updateProfile: body => request('/api/account/profile', { method: 'PATCH', body: JSON.stringify(body) }), uploadAvatar: file => { const body = new FormData(); body.append('file', file); return request('/api/account/avatar', { method: 'POST', body }) }, removeAvatar: () => request('/api/account/avatar', { method: 'DELETE' }), protectAccount: ({ displayName, email, password, confirmPassword }) => request('/api/account/protect', { method: 'POST', body: JSON.stringify({ displayName, email, password, confirmPassword }) }), changePassword: body => request('/api/account/password', { method: 'POST', body: JSON.stringify(body) }), switchAccount: id => request(`/api/account/switch/${id}`, { method: 'POST' }), removeAccountFromDevice: () => request('/api/account/device', { method: 'DELETE' }), deleteAccount: body => request('/api/account/current', { method: 'DELETE', body: JSON.stringify(body) }),
  summary: () => request('/api/financial-summary'), updateSettings: initialBalance => request('/api/financial-settings', { method: 'PUT', body: JSON.stringify({ initialBalance: amountValue(initialBalance) }) }), commitments: (status = 'active') => { const query = status === 'active' ? '?isCompleted=false' : status === 'completed' ? '?isCompleted=true' : ''; return request(`/api/financial-commitments${query}`) }, categories: () => request('/api/groups'), createCategory: name => request('/api/groups', { method: 'POST', body: JSON.stringify({ name }) }), updateCategory: (id, name) => request(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }), deleteCategory: id => request(`/api/groups/${id}`, { method: 'DELETE' }),
  financialForecast: (from, months = 6) => { const params = new URLSearchParams({ months: String(months) }); if (from) params.set('from', `${String(from).slice(0, 7)}-01`); return request(`/api/financial-forecast?${params}`) },
  incomes: (params = {}) => request(`/api/transactions?Type=Income&PageSize=100&${new URLSearchParams(params)}`),
  expenses: (params = {}) => request(`/api/transactions?Type=Expense&PageSize=100&${new URLSearchParams(params)}`),
  recurringIncomes: () => request('/api/recurring-incomes'), recurringProjection: () => request('/api/recurring-incomes/projection'),
  createRecurringIncome: body => request('/api/recurring-incomes', { method: 'POST', body: JSON.stringify(body) }), updateRecurringIncome: (id, body) => request(`/api/recurring-incomes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  pauseRecurringIncome: id => request(`/api/recurring-incomes/${id}/pause`, { method: 'POST' }), activateRecurringIncome: id => request(`/api/recurring-incomes/${id}/activate`, { method: 'POST' }), deleteRecurringIncome: id => request(`/api/recurring-incomes/${id}`, { method: 'DELETE' }), receiveRecurringOccurrence: id => request(`/api/recurring-incomes/occurrences/${id}/receive`, { method: 'POST' }),
  createIncome: body => request('/api/transactions', { method: 'POST', body: JSON.stringify({ ...body, type: 'Income' }) }),
  createExpense: body => request('/api/transactions', { method: 'POST', body: JSON.stringify({ ...body, type: 'Expense' }) }),
  deleteIncome: id => request(`/api/transactions/${id}`, { method: 'DELETE' }),
  updateTransaction: (id, body) => request(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteExpense: id => request(`/api/transactions/${id}`, { method: 'DELETE' }),
  allocate: (id, amount) => request(`/api/financial-commitments/${id}/allocations`, { method: 'POST', body: JSON.stringify({ amount: amountValue(amount) }) }),
  allocateNextInstallment: id => request(`/api/financial-commitments/${id}/allocations/next-installment`, { method: 'POST' }),
  allocateAvailable: id => request(`/api/financial-commitments/${id}/allocations/available`, { method: 'POST' }),
  deallocate: (id, amount) => request(`/api/financial-commitments/${id}/deallocations`, { method: 'POST', body: JSON.stringify({ amount: amountValue(amount) }) }),
  releaseAllAllocation: id => request(`/api/financial-commitments/${id}/allocations`, { method: 'DELETE' }),
  payInstallment: id => request(`/api/financial-commitments/${id}/payments`, { method: 'POST' }),
  payCommitmentOccurrence: (commitmentId, occurrenceId) => request(`/api/financial-commitments/${commitmentId}/occurrences/${occurrenceId}/payment`, { method: 'POST' }),
  reversePayment: id => request(`/api/financial-commitments/${id}/payments/latest`, { method: 'DELETE' }),
  reverseCommitmentOccurrencePayment: (commitmentId, occurrenceId) => request(`/api/financial-commitments/${commitmentId}/occurrences/${occurrenceId}/payment`, { method: 'DELETE' }),
  createCommitment: body => request('/api/financial-commitments', { method: 'POST', body: JSON.stringify(body) }),
  updateCommitment: (id, body) => request(`/api/financial-commitments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCommitment: id => request(`/api/financial-commitments/${id}`, { method: 'DELETE' })
}
