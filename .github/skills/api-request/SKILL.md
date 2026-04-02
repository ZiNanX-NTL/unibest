---
name: api-request
description: '编写 API 请求函数和页面中使用请求。USE FOR: 创建新的 API 接口函数、在页面/组件中调用请求、使用 useRequest/useWatcher/useFetcher、配置缓存/transform/轮询、处理分页请求、上传文件、解释 alova Method 实例和本项目 RequestResult 解包约定。DO NOT USE FOR: 修改底层 service/http 拦截器实现或重构请求基座。'
argument-hint: '描述你要创建的 API、页面请求场景，或想理解的 alova / transform 用法'
---

# API Request

本项目前端请求基于 alova v3，但项目内部又叠加了一层自己的约定。

回答或编写请求代码时，不要只按 alova 官方通用写法处理，要先区分当前代码使用的是哪套实例，以及返回值是否已经被解包。

## 项目中的两套 HTTP 实例

### 1. `@/service` — 主业务实例

- 导出来源：`src/service/index.ts` -> `src/service/instances/alova.ts`
- 实际实例名：`alovaInstance`
- 请求前/响应后拦截由 `src/service/instances/alovaInterceptor.ts` 中的 `RequestInterceptor` 负责
- 响应成功后默认会包装成 `Service.RequestResult<T>`
- 通常需要配合 `transform` 解包成真正业务数据

适用场景：

- 当前项目的大部分业务接口
- 需要统一走 `RequestResult` 结构的接口
- 需要复用 `unwrapResult` / `composeTransform` 约定的接口


### 2. `@/http/alova` — 备用实例

- 文件：`src/http/alova.ts`
- 响应拦截器直接返回业务数据 `Data`
- 一般不需要额外 `transform` 解包

适用场景：

- 登录、用户信息等已按该实例风格实现的模块
- 现有代码已经基于此实例时，保持一致

## 请求链路

当你使用 `@/service` 时，请求链路通常是：

1. API 层调用 `alovaInstance.Get/Post/...`
2. 返回一个 `Method` 实例，而不是立即返回业务数据
3. 在 `await method`、`useRequest(method)`、`method.then(...)` 时才真正发送请求
4. `beforeRequest` 处理请求体转换、域名切换、鉴权
5. `responded.onSuccess` 基于 `backendConfig` 解析后端响应
6. 返回 `Service.RequestResult<T>`
7. 若 API 层配置 `transform: composeTransform(unwrapResult)`，则进一步解包为业务数据

## Method 实例心智模型

alova 的 `Get/Post/...` 返回的是 `Method`，不是已经完成的结果。

```ts
const method = alovaInstance.Post('/api/demo', { id: 1 })

await method
method.then(() => {})
useRequest(method)
```

因此 API 函数应优先返回 `Method` 实例，这样组件层才能直接复用 alova hooks、缓存、共享请求等能力。


## 编写 API 函数

### 使用 `@/service` 实例（标准模式）

```typescript
import { alovaInstance } from '@/service'
import { composeTransform, unwrapResult } from '@/utils/transform'

// ✅ 基础用法：默认启用 unwrapResult 解包
export function fetchWeather(params: any, isTransform = true) {
  return alovaInstance.Post<any>('/FarmService/MainService/getWeather', params, {
    cacheFor: 60 * 60, // 缓存1小时
    transform: composeTransform(isTransform && unwrapResult),
  })
}

// ✅ 带类型的 GET 请求
export function getUserList(params: { page: number; pageSize: number }) {
  return alovaInstance.Get<PageResult<IUser>>('/user/list', {
    params,
    transform: composeTransform(unwrapResult),
  })
}

// ✅ 管道式 transform：解包后再提取子字段
export function getRecords(params: any) {
  return alovaInstance.Post<any>('/api/records', params, {
    transform: composeTransform(
      unwrapResult,
      (data) => data.records,
    ),
  })
}

// ✅ 关闭 transform，拿到原始 { error, data } 结构
export function fetchRaw(params: any) {
  return alovaInstance.Post<any>('/api/data', params, {
    // 不传 transform，或传 composeTransform(false)
  })
}
```

### 使用 `@/http/alova` 实例（直接返回业务数据）

```typescript
import { http } from '@/http/alova'

// 响应拦截器已解包，直接返回 Data 字段
export function login(loginForm: ILoginForm) {
  return http.Post<IAuthLoginRes>('/auth/login', loginForm)
}

export function getUserInfo() {
  return http.Get<IUserInfoRes>('/user/info')
}
```

### 动态域名切换

```typescript
import { API_DOMAINS, alovaInstance } from '@/service'

export function foo() {
  return alovaInstance.Get<IFoo>('/foo', {
    meta: { domain: API_DOMAINS.SECONDARY },
  })
}
```

### 跳过鉴权

```typescript
export function publicApi() {
  return http.Get<any>('/public/data', {
    meta: { ignoreAuth: true },
  })
}
```

## Transform 工具函数

文件位置：`src/utils/transform.ts`

| 函数 | 说明 |
|------|------|
| `unwrapResult` | 解包 `Service.RequestResult`，提取 `data`，`error` 时抛异常 |
| `composeTransform(...fns)` | 组合多个 transform 为管道，支持传 `false/null/undefined` 跳过 |

```typescript
// 条件开关
composeTransform(isTransform && unwrapResult)

// 管道组合
composeTransform(unwrapResult, (data) => data.list)

// 全部跳过 → 返回 undefined（不做转换）
composeTransform(false)
```

## 主实例的后端响应约定

`src/service/instances/alovaInterceptor.ts` 中默认 `backendConfig` 为：

```ts
{
  codeKey: 'Code',
  dataKey: 'Data',
  msgKey: 'Desc',
  successCode: '0',
}
```

因此主实例默认期望后端结构为：

```json
{
  "Code": "0",
  "Data": { ... },
  "Desc": "成功"
}
```

拦截器解析后统一变成：

```ts
// 成功
{ error: null, data: <Data字段值> }

// 失败
{ error: { type: 'backend' | 'http' | 'uniRequest', code, msg }, data: null }
```

再由 `unwrapResult` 决定是否继续解包和抛错。

## 页面中使用请求

### 方式一：Alova `useRequest`（推荐，自动管理 loading/error/data）

```vue
<script lang="ts" setup>
import { useRequest } from 'alova/client'
import { fetchWeather } from '@/api/home'

// 组件挂载时自动发起请求
const { loading, error, data } = useRequest(
  fetchWeather({ city: '北京' })
)
</script>

<template>
  <view v-if="loading">加载中...</view>
  <view v-else-if="error">{{ error.message }}</view>
  <view v-else>{{ data }}</view>
</template>
```

适合：

- 页面进入即加载
- 按钮点击后单次请求
- 表单提交

### 方式二：Alova `useRequest` 手动触发

```vue
<script lang="ts" setup>
import { useRequest } from 'alova/client'
import { submitForm } from '@/api/form'

// immediate: false → 不自动发起，需要手动调用 send
const { loading, data, send } = useRequest(
  (formData) => submitForm(formData),
  { immediate: false }
)

async function handleSubmit(formData: any) {
  await send(formData)
  uni.showToast({ title: '提交成功' })
}
</script>
```

### 方式三：Alova `useWatcher` 监听参数变化自动请求

```vue
<script lang="ts" setup>
import { useWatcher } from 'alova/client'
import { getUserList } from '@/api/user'

const page = ref(1)
const pageSize = ref(10)

const { loading, data } = useWatcher(
  () => getUserList({ page: page.value, pageSize: pageSize.value }),
  [page, pageSize],
  { immediate: true }
)
</script>
```

关键点：

- 第一个参数必须是返回 `Method` 的函数
- 不要直接传 `getUserList(...)` 的结果给 `useWatcher`

### 方式四：自定义 `useRequest` Hook

```vue
<script lang="ts" setup>
import useRequest from '@/hooks/useRequest'
import { fetchWeather } from '@/api/home'

// 适用于简单场景，immediate 控制是否立即执行
const { loading, data, run } = useRequest(
  () => fetchWeather({ city: '北京' }),
  { immediate: true }
)
</script>
```

这个 `src/hooks/useRequest.ts` 不是 alova 官方 hook，而是轻量 Promise 包装器。

结论：

- 如果你返回的是 alova `Method`，优先使用 `alova/client` 的 hooks
- 如果你处理的是普通 Promise 函数，再考虑项目自定义 hook

### `useFetcher`

适合：

- 预加载数据
- 跨组件触发刷新
- 从组件外部刷新某个请求

如果用户问到 `useFetcher` 具体 API 选项，而你不能确定细节，先查 alova 官方文档再回答。

## 缓存配置

```typescript
// 内存缓存（毫秒），页面级缓存
http.Get<any>('/api/data', {
  cacheFor: 5 * 60 * 1000, // 5分钟
})

// 也支持秒为单位（alova 内部判断）
http.Post<any>('/api/data', params, {
  cacheFor: 60 * 60, // 1小时
})
```

建议：

- 读请求可优先考虑缓存
- 写请求优先配合 `hitSource` 或手动失效缓存，而不是盲目设置缓存

## 后端响应结构

`@/service` 实例对应的后端返回格式：

```json
{
  "Code": "0",
  "Data": { ... },
  "Desc": "成功"
}
```

经过响应拦截器后，被包装为：

```typescript
// 成功
{ error: null, data: <Data字段的值> }

// 失败（Code !== '0' 或 HTTP 错误）
{ error: { type: 'backend', code: '1001', msg: '错误描述' }, data: null }
```

使用 `unwrapResult` 解包后：

- 成功 → 直接返回 `Data` 字段的值
- 失败 → 抛出 `error` 异常

## 上传场景

项目当前上传主要使用 `src/hooks/useUpload.ts`，底层是 `uni.uploadFile`，不是 alova 的 `useUploader`。

因此：

- 维护现有上传逻辑时，优先复用 `useUpload.ts`
- 只有用户明确要求基于 alova 重构上传体验时，再考虑 `useUploader`

## 类型定义

在 `src/api/types/` 下定义接口类型：

```typescript
// src/api/types/user.ts
export interface IUser {
  id: number
  name: string
  avatar?: string
}
```

在 API 函数中使用泛型：

```typescript
import type { IUser } from './types/user'

export function getUser(id: number) {
  return alovaInstance.Get<IUser>(`/user/${id}`, {
    transform: composeTransform(unwrapResult),
  })
}
```

类型心智：

- `Method` 的最终返回类型由泛型决定
- `transform` 的输入是拦截器产物
- `transform` 的输出才是组件里 `data` 的类型

在主实例下，通常可以理解为：

- transform 前：`Service.RequestResult<T>`
- transform 后：`T`

## 常见坑

### 1. 在 API 层提前 await Method

不推荐：

```ts
export async function getUser() {
  return await alovaInstance.Get('/user/info')
}
```

这样会丢失 alova hooks 的能力。

### 2. `useWatcher` 直接传 Method

错误：

```ts
useWatcher(getUserList(params), [page])
```

正确：

```ts
useWatcher(() => getUserList(params.value), [page], { immediate: true })
```

### 3. 主实例忘记解包

如果你使用 `@/service`，但没有配置 `unwrapResult`，组件里拿到的可能是 `{ error, data }`，而不是最终业务数据。

### 4. 混淆两套实例

- `@/service`：通常要考虑 `RequestResult` + transform
- `@/http/alova`：通常已直接返回业务数据

写代码前先确认当前文件导入的是哪套实例。

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `src/service/instances/alova.ts` | 主 alova 实例 |
| `src/service/instances/alovaInterceptor.ts` | 主实例的请求/响应拦截器类 |
| `src/http/alova.ts` | 备用 alova 实例（直接返回业务数据） |
| `src/utils/transform.ts` | transform 工具函数 |
| `src/service/helpers/handler.ts` | `handleServiceResult` 统一结果封装 |
| `src/service/helpers/error.ts` | 错误处理函数 |
| `src/service/helpers/msg.ts` | 错误消息弹窗（防重复） |
| `src/service/helpers/config.ts` | 超时、错误码、状态码映射等常量 |
| `src/types/service.d.ts` | `Service` 命名空间类型定义 |
| `src/http/types.ts` | HTTP 层补充类型 |
| `src/hooks/useRequest.ts` | 自定义 useRequest hook |
| `src/hooks/useUpload.ts` | 文件上传 hook |
| `src/api/types/` | API 接口类型定义目录 |

## 处理请求类任务的建议流程

1. 先看当前代码 import 的是 `@/service` 还是 `@/http/alova`
2. 判断调用方是页面、store、工具函数还是上传场景
3. 如果是主实例，先确认是否需要 `unwrapResult`
4. 响应式依赖驱动的请求优先 `useWatcher`
5. 单次请求优先 `useRequest`
6. 上传优先复用 `src/hooks/useUpload.ts`
7. 遇到 alova hooks 具体参数、边界行为或版本差异，不确定时先查官方文档
