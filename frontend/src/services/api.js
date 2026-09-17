const API_URL = import.meta.env.VITE_API_URL || ''
async function request(path, options = {}) { const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options }); if (!response.ok) { let body = {}; try { body = await response.json() } catch {} throw new Error(body.message || `Erro ${response.status} ao acessar a API.`) } return response.status === 204 ? null : response.json() }
export const api = {
  summary: () => request('/api/financial-summary'), settings: () => request('/api/financial-settings'), updateSettings: initialBalance => request('/api/financial-settings', { method: 'PUT', body: JSON.stringify({ initialBalance: Number(initialBalance) }) }), commitments: () => request('/api/financial-commitments'), preview: () => request('/api/allocations/preview'), distribute: () => request('/api/allocations/distribute'),
  allocate: (id, amount) => request(`/api/financial-commitments/${id}/allocations`, { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) }),
  deallocate: (id, amount) => request(`/api/financial-commitments/${id}/deallocations`, { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) }),
  createCommitment: body => request('/api/financial-commitments', { method: 'POST', body: JSON.stringify(body) }),
  updateCommitment: (id, body) => request(`/api/financial-commitments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCommitment: id => request(`/api/financial-commitments/${id}`, { method: 'DELETE' })
}
