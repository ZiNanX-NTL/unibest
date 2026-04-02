type TransformFn<T = any, R = any> = (data: T) => R

/** 解包 Service.RequestResult，提取 data，error 时抛出异常 */
export const unwrapResult: TransformFn = (data) => {
  const { error, data: result } = data as Service.RequestResult
  if (error) throw error
  return result
}

/**
 * 组合多个 transform 函数为管道，支持条件性传入
 *
 * @example
 * // 默认解包
 * transform: composeTransform(unwrapResult)
 *
 * // 通过参数控制是否启用
 * transform: composeTransform(isTransform && unwrapResult)
 *
 * // 解包 + 自定义处理
 * transform: composeTransform(unwrapResult, (data) => data.list)
 *
 * // 多级管道
 * transform: composeTransform(
 *   unwrapResult,
 *   (data) => data.records,
 *   (list) => list.filter(Boolean),
 * )
 */
export function composeTransform(
  ...fns: (TransformFn | false | null | undefined)[]
): TransformFn | undefined {
  const activeFns = fns.filter(Boolean) as TransformFn[]
  if (activeFns.length === 0) return undefined
  if (activeFns.length === 1) return activeFns[0]
  return (data: any) => activeFns.reduce((acc, fn) => fn(acc), data)
}
