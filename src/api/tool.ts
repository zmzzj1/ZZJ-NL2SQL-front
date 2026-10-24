import type { DiscoveredTool, McpServer, McpServerInput, McpServerView, McpTool, ToolDescriptor } from './contract';
import { requestJson } from './http';

/** 旧内置工具目录：保持稳定，供 Agent Studio 白名单配置使用。 */
export async function fetchTools(): Promise<ToolDescriptor[]> {
  return requestJson<ToolDescriptor[]>('/v1/tools');
}

/** P14-E：当前用户作用域的统一工具目录（内置 / MCP / Skill）。 */
export async function fetchToolDiscovery(): Promise<DiscoveredTool[]> {
  return requestJson<DiscoveredTool[]>('/v1/tools/discovery');
}

export async function invokeTool(toolName: string, arguments_: Record<string, unknown>): Promise<unknown> {
  return requestJson<unknown>('/v1/tools/invoke', {
    method: 'POST',
    body: JSON.stringify({ toolName, arguments: arguments_ }),
  });
}

/** 旧 MCP 只读列表（P6 遗留接口），新页面使用 `listMcpServers`。 */
export async function fetchMcpServers(): Promise<McpServer[]> {
  return requestJson<McpServer[]>('/v1/mcp/servers');
}

export async function testMcpServer(name: string): Promise<McpTool[]> {
  return requestJson<McpTool[]>(`/v1/mcp/servers/${name}/test`, { method: 'POST' });
}

/** P14-E：用户级 MCP 服务管理。归属由服务端按认证会话强制，前端不传 userId。 */
export async function listMcpServers(): Promise<McpServerView[]> {
  return requestJson<McpServerView[]>('/v1/mcp-servers');
}

export async function createMcpServer(input: McpServerInput): Promise<McpServerView> {
  return requestJson<McpServerView>('/v1/mcp-servers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMcpServer(id: number, input: McpServerInput): Promise<McpServerView> {
  return requestJson<McpServerView>(`/v1/mcp-servers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteMcpServer(id: number): Promise<void> {
  await requestJson<void>(`/v1/mcp-servers/${id}`, { method: 'DELETE' });
}

export async function connectMcpServer(id: number): Promise<McpServerView> {
  return requestJson<McpServerView>(`/v1/mcp-servers/${id}/connect`, { method: 'POST' });
}

export async function disconnectMcpServer(id: number): Promise<McpServerView> {
  return requestJson<McpServerView>(`/v1/mcp-servers/${id}/disconnect`, { method: 'POST' });
}

export async function refreshMcpServerStatus(id: number): Promise<McpServerView> {
  return requestJson<McpServerView>(`/v1/mcp-servers/${id}/status`);
}
