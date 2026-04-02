import type { AlovaGenerics, Method } from 'alova'
import { handleBackendError, handleResponseError, handleServiceResult, transformRequestData } from '../helpers'

const DEFAULT_BACKEND_CONFIG: Service.BackendResultConfig = {
  codeKey: 'Code',
  dataKey: 'Data',
  msgKey: 'Desc',
  successCode: '0',
}

export class RequestInterceptor<AG extends AlovaGenerics = AlovaGenerics> {
  private backendConfig: Service.BackendResultConfig

  constructor(backendConfig?: Partial<Service.BackendResultConfig>) {
    this.backendConfig = { ...DEFAULT_BACKEND_CONFIG, ...backendConfig }
  }

  beforeRequest = async (method: Method<AG>) => {
    console.log('实例请求拦截')
    const { config } = method
    if (config.headers) {
      const contentType = config.headers['Content-Type'] as Service.ContentType
      method.data = await transformRequestData(method.data, contentType)
    }
    if (config.meta?.domain) {
      method.baseURL = config.meta.domain
      console.log('当前域名', method.baseURL)
    }
  }

  responded = {
    onSuccess: async (response: AG['Response'], method: Method<AG>) => {
      console.log('实例响应拦截')
      const {
        statusCode,
      } = response as UniNamespace.RequestSuccessCallbackResult
      console.log('response===>', response)
      const { config } = method
      const { requestType } = config

      if (statusCode === 200 || statusCode < 300 || statusCode === 304) {
        if (requestType === 'upload' || requestType === 'download') {
          return handleServiceResult(null, (response as any).data)
        }
        const backend = { ...(response as any).data }
        const { codeKey, dataKey, successCode } = this.backendConfig
        if (backend[codeKey] === successCode) {
          const resultData = dataKey ? backend[dataKey] : backend
          return handleServiceResult(null, resultData)
        }

        const error = handleBackendError(backend, this.backendConfig)
        return handleServiceResult(error, null)
      }
      const error = handleResponseError(response as UniNamespace.RequestSuccessCallbackResult)
      return handleServiceResult(error, null)
    },
  }
}
