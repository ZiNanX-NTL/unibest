import type { uniappRequestAdapter } from '@alova/adapter-uniapp'
import AdapterUniapp from '@alova/adapter-uniapp'
import { createAlova } from 'alova'
import { createServerTokenAuthentication } from 'alova/client'
import VueHook from 'alova/vue'
import { toLoginPage } from '@/utils/toLoginPage'
import type { Method } from 'alova'
import { handleBackendError, handleResponseError, handleServiceResult, transformRequestData } from '../helpers'

// 配置动态Tag
export const API_DOMAINS = {
  DEFAULT: import.meta.env.VITE_SERVER_BASEURL,
  SECONDARY: import.meta.env.VITE_SERVER_BASEURL_SECONDARY,
}

/**
 * 创建请求实例
 */
const { onAuthRequired, onResponseRefreshToken } = createServerTokenAuthentication<
  typeof VueHook,
  typeof uniappRequestAdapter
>({
  // 如果下面拦截不到，请使用 refreshTokenOnSuccess by 群友@琛
  refreshTokenOnError: {
    isExpired: (error) => {
      return error.response?.status === 401
    },
    handler: async () => {
      try {
        // await authLogin();
      }
      catch (error) {
        // 切换到登录页
        toLoginPage({ mode: 'reLaunch' })
        throw error
      }
    },
  },
})

const backendConfig: Service.BackendResultConfig = {
  codeKey: 'Code',
  dataKey: 'Data',
  msgKey: 'Desc',
  successCode: '0'
}
const interceptors = {
  beforeRequest: async (method: Method) => { 
    console.log("实例请求拦截");
    const { config } = method;
    if (config.headers) {
      // 数据转换
      const contentType = config.headers['Content-Type'] as Service.ContentType;
      method.data = await transformRequestData(method.data, contentType);
      // 设置token
      // config.headers.Authorization = localStg.get('token') || '';
    }
    // 处理动态域名
    if (config.meta?.domain) {
      method.baseURL = config.meta.domain
      console.log('当前域名', method.baseURL)
    }
  },
  responded: {
    onSuccess: async (response: any, method: Method) => {
      console.log("实例响应拦截");
      const {
        statusCode,
        data,
        errMsg,
      } = response as UniNamespace.RequestSuccessCallbackResult
      console.log('response===>', response)
      const { config } = method
      const { requestType } = config

      if (statusCode === 200 || statusCode < 300 || statusCode === 304) {
        // 处理特殊请求类型（上传/下载）
        if (requestType === 'upload' || requestType === 'download') {
          return handleServiceResult(null, response.data);
        }
        const backend = { ...response.data };
        const { codeKey, dataKey, successCode } = backendConfig;
        // 请求成功
        if (backend[codeKey] === successCode) {
          // dataKey 为空时返回整个 backend 对象
          const resultData = dataKey ? backend[dataKey] : backend;
          return handleServiceResult(null, resultData);
        }

        const error = handleBackendError(backend, backendConfig);
        return handleServiceResult(error, null);
      }
      const error = handleResponseError(response);
      return handleServiceResult(error, null);
    }
  }
}

/**
 * alova 请求实例
 */
const alovaInstance = createAlova({
  baseURL: API_DOMAINS.DEFAULT,
  ...AdapterUniapp(),

  beforeRequest: onAuthRequired(async (method) => {
    await interceptors.beforeRequest?.(method);

    const { config } = method
    const requiresAuth = !config.meta?.ignoreAuth
    console.log('requiresAuth===>', requiresAuth)
    // 处理认证信息   自行处理认证问题
    if (requiresAuth) {
      const token = 'getToken()'
      if (!token) {
        throw new Error('[请求错误]：未登录')
      }
      // method.config.headers.token = token;
    }
  }),

  responded: onResponseRefreshToken({
    onSuccess: async (response, method) => {
      const result = await interceptors.responded.onSuccess?.(response, method);

      // 处理成功响应，返回业务数据
      return result
    },
    onError: async (error, method) => {
      // 处理响应错误
      console.error('请求响应错误===>', error)
    }
  })
})

export const http = alovaInstance
