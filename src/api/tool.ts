import type { McpServer, McpTool, ToolDescriptor } from './contract';
import { requestJson } from './http';

export async function fetchTools(): Promise<ToolDescriptor[]> {
  return requestJson<ToolDescriptor[]>('/v1/tools');
}

export async function invokeTool(toolName: string, arguments_: Record<string, unknown>): Promise<unknown> {
  return requestJson<unknown>('/v1/tools/invoke', {
    method: 'POST',
    body: JSON.stringify({ toolName, arguments: arguments_ }),
  });
}

export async function fetchMcpServers(): Promise<McpServer[]> {
  return requestJson<McpServer[]>('/v1/mcp/servers');
}

export async function testMcpServer(name: string): Promise<McpTool[]> {
  return requestJson<McpTool[]>(`/v1/mcp/servers/${name}/test`, { method: 'POST' });
}
