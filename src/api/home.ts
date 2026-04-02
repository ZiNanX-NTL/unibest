import { http } from '@/service'
import { composeTransform, unwrapResult } from '@/utils/transform'

/**
 * 获取实时天气
 */
export function fetchWeather(params: any, isTransform = true) {
  return http.Post<any>('/FarmService/MainService/getWeather', params, {
    cacheFor: 60 * 60, // 缓存1小时
    transform: composeTransform(isTransform && unwrapResult),
  })
}
