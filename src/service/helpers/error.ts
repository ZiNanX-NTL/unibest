import { DEFAULT_REQUEST_ERROR_CODE, DEFAULT_REQUEST_ERROR_MSG, ERROR_STATUS } from './config';
import { showErrorMsg } from './msg';

type ErrorStatus = keyof typeof ERROR_STATUS;

/**
 * 处理axios请求失败的错误
 * @param uniRequestError - 错误
 */
export function handleUniRequestError(uniRequestError: UniApp.GeneralCallbackResult) {
  const error: Service.RequestError = {
    type: 'uniRequest',
    code: DEFAULT_REQUEST_ERROR_CODE,
    msg: uniRequestError.errMsg || DEFAULT_REQUEST_ERROR_MSG
  };

  showErrorMsg(error);

  return error;
}

/**
 * 处理请求成功后的错误
 * @param response - 请求的响应
 */
export function handleResponseError(response: UniApp.RequestSuccessCallbackResult) {
  const error: Service.RequestError = {
    type: 'uniRequest',
    code: DEFAULT_REQUEST_ERROR_CODE,
    msg: DEFAULT_REQUEST_ERROR_MSG
  };

  // if (!window.navigator.onLine) {
  //   // 网路错误
  //   Object.assign(error, { code: NETWORK_ERROR_CODE, msg: NETWORK_ERROR_MSG });
  // } else {
  // 请求成功的状态码非200的错误
  const errorCode: ErrorStatus = response.statusCode as ErrorStatus;
  const msg = ERROR_STATUS[errorCode] || DEFAULT_REQUEST_ERROR_MSG;
  Object.assign(error, { type: 'http', code: errorCode, msg });
  // }

  showErrorMsg(error);

  return error;
}

/**
 * 处理后端返回的错误(业务错误)
 * @param backendResult - 后端接口的响应数据
 */
export function handleBackendError(backendResult: Record<string, any>, config: Service.BackendResultConfig) {
  const { codeKey, msgKey } = config;
  const error: Service.RequestError = {
    type: 'backend',
    code: backendResult[codeKey],
    msg: backendResult[msgKey]
  };

  showErrorMsg(error);

  return error;
}
