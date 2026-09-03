import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

function toQueryString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

const uniAdapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method ?? 'get').toUpperCase() as UniApp.RequestOptions['method']
  const query = config.params ? toQueryString(config.params as Record<string, unknown>) : ''
  const url = `${config.baseURL ?? ''}${config.url ?? ''}${query ? `?${query}` : ''}`

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data: config.data,
      header: config.headers as Record<string, string>,
      success: (response) => {
        const body = response.data as { data?: unknown; message?: string; success?: boolean }
        if (response.statusCode >= 200 && response.statusCode < 300 && body.success !== false) {
          resolve({
            data: body.data ?? body,
            status: response.statusCode,
            statusText: '',
            headers: response.header,
            config: config as InternalAxiosRequestConfig,
          })
          return
        }
        reject(new Error(body.message ?? '请求失败'))
      },
      fail: (error) => reject(new Error(error.errMsg || '网络异常，请稍后重试')),
    })
  })
}

export const http = axios.create({ baseURL: API_BASE_URL, adapter: uniAdapter })

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = uni.getStorageSync<string>('customer_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['Content-Type'] = 'application/json'
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: Error & { response?: { status?: number } }) => {
    if (error.response?.status === 401) {
      uni.removeStorageSync('customer_access_token')
      uni.removeStorageSync('customer_refresh_token')
      uni.reLaunch({ url: '/pages/login/index' })
    }
    return Promise.reject(error)
  },
)

export const request = async <T>(config: AxiosRequestConfig): Promise<T> =>
  (await http.request<T>(config)).data
