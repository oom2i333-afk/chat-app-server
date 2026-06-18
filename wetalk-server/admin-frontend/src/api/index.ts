import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1/admin',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const login = (username: string, password: string) =>
  api.post('/login', { username, password })

export const getDashboard = () => api.get('/dashboard')

export const getUsers = (params?: any) => api.get('/users', { params })

export const banUser = (uid: string) => api.post(`/users/${uid}/ban`, {})

export const unbanUser = (uid: string) => api.post(`/users/${uid}/unban`, {})

export const getGroups = () => api.get('/groups')

export const getRedPackets = () => api.get('/redpackets')

export const getTransactions = () => api.get('/transactions')
