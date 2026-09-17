const API_URL = import.meta.env.VITE_API_URL || ''
const amountValue = value => Number(String(value).trim().replace(',', '.'))
async function request(path, options = {}) { const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options }); if (!response.ok) { let body = {}; try { body = await response.json() } catch {} const validation = body.errors ? Object.values(body.errors).flat().join(' ') : ''; const error = new Error(body.message || validation || `Erro ${response.status} ao acessar a API.`); error.status = response.status; error.validation = body.errors || {}; throw error } return response.status === 204 ? null : response.json() }
export const api = {
  summary: () => request('/api/financial-summary'), updateSettings: initialBalance => request('/api/financial-settings', { method: 'PUT', body: JSON.stringify({ initialBalance: Number(initialBalance) }) }), commitments: () => request('/api/financial-commitments'), categories: () => request('/api/categories'), createCategory: name => request('/api/categories', { method: 'POST', body: JSON.stringify({ name }) }), updateCategory: (id, name) => request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }), deleteCategory: id => request(`/api/categories/${id}`, { method: 'DELETE' }), preview: () => request('/api/allocations/preview'), distribute: () => request('/api/allocations/distribute'),
  allocate: (id, amount) => request(`/api/financial-commitments/${id}/allocations`, { method: 'POST', body: JSON.stringify({ amount: amountValue(amount) }) }),
  deallocate: (id, amount) => request(`/api/financial-commitments/${id}/deallocations`, { method: 'POST', body: JSON.stringify({ amount: amountValue(amount) }) }),
  payInstallment: id => request(`/api/financial-commitments/${id}/payments`, { method: 'POST' }),
  createCommitment: body => request('/api/financial-commitments', { method: 'POST', body: JSON.stringify(body) }),
  updateCommitment: (id, body) => request(`/api/financial-commitments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCommitment: id => request(`/api/financial-commitments/${id}`, { method: 'DELETE' })
}
