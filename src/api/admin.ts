import type { AdminDashboard } from './model';
import { requestJson } from './http';

// P13-M3A/M3B：独立管理服务（Gateway 精确路由到 zzj-admin）的用户管理 API。
// 权限自检、用户列表、概览复用既有接口；状态/配额变更为 M3B 新增。

export interface AdminUserSummary {
  id: number;
  email: string;
  displayName: string;
  role: string;
  createdAt: string | null;
  /** P13-M3B：账号状态 ACTIVE / DISABLED。 */
  status: string | null;
  /** P13-M3B：用户级 Token 配额；0 或 null 表示未单独设置（不限制）。 */
  tokenQuota: number | null;
}

export interface AdminUserPage {
  items: AdminUserSummary[];
  total: number;
  page: number;
  size: number;
}

export interface AdminCheckResponse {
  isAdmin: boolean;
  role: string;
}

export interface AdminUserOperationResult {
  userId: number;
  status: string;
  tokenQuota: number | null;
  role: string;
}

export async function adminUsers(
  params: { page?: number; size?: number; keyword?: string } = {},
): Promise<AdminUserPage> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.size) query.set('size', String(params.size));
  if (params.keyword) query.set('keyword', params.keyword);
  const suffix = query.toString();
  return requestJson<AdminUserPage>(`/v1/admin/users${suffix ? `?${suffix}` : ''}`);
}

export async function adminDashboard(): Promise<AdminDashboard> {
  return requestJson<AdminDashboard>('/v1/admin/dashboard');
}

/** P13-M3B：平台管理权限自检；未登录/非管理员由后端返回 401/403。 */
export async function adminCheck(): Promise<AdminCheckResponse> {
  return requestJson<AdminCheckResponse>('/v1/admin/check');
}

/** P13-M3B：启用/停用用户。status 仅接受 ACTIVE / DISABLED。 */
export async function adminSetUserStatus(
  userId: number,
  status: 'ACTIVE' | 'DISABLED',
): Promise<AdminUserOperationResult> {
  return requestJson<AdminUserOperationResult>(`/v1/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

/** P13-M3B：调整用户级 Token 配额（非负整数，0 表示不单独限制）。 */
export async function adminSetUserQuota(userId: number, tokenQuota: number): Promise<AdminUserOperationResult> {
  return requestJson<AdminUserOperationResult>(`/v1/admin/users/${userId}/quota`, {
    method: 'PUT',
    body: JSON.stringify({ tokenQuota }),
  });
}
