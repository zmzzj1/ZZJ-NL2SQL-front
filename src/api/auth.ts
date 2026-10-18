import type { LoginRequest, RegisterRequest, User } from './contract';
import { requestJson } from './http';

/** 创建账号；会话由上层在注册成功后调用登录接口建立。 */
export async function register(input: RegisterRequest): Promise<User> {
  return requestJson<User>('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export async function login(input: LoginRequest): Promise<User> {
  return requestJson<User>('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export async function fetchCurrentUser(): Promise<User> {
  return requestJson<User>('/v1/auth/me');
}

export async function logout(): Promise<void> {
  await requestJson<void>('/v1/auth/logout', { method: 'POST' });
}
