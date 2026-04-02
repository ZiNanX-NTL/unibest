import type { uniappRequestAdapter } from '@alova/adapter-uniapp'
import AdapterUniapp from '@alova/adapter-uniapp'
import { createAlova } from 'alova'
import { createServerTokenAuthentication } from 'alova/client'
import VueHook from 'alova/vue'
import { toLoginPage } from '@/utils/toLoginPage'
import { RequestInterceptor } from './alovaInterceptor'

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

const interceptors = new RequestInterceptor()

/**
 * alova 请求实例
 */
export const alovaInstance = createAlova({
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
