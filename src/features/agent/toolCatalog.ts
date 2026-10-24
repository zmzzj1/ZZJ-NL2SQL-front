/**
 * P14-E：工具目录变化通知。MCP 连接/断开/删除发生在管理页，
 * 而工具选择器在 Agent 输入区，两者通过这个轻量事件保持真实目录一致，
 * 不引入额外全局状态容器。
 */
export const MCP_CATALOG_CHANGED_EVENT = 'mcp:catalog-changed';

export function notifyToolCatalogChanged() {
  window.dispatchEvent(new Event(MCP_CATALOG_CHANGED_EVENT));
}
