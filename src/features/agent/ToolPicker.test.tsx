import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ToolModule from '../../api/tool';
import type { DiscoveredTool } from '../../api/contract';
import { ToolPicker } from './ToolPicker';
import { fetchToolDiscovery } from '../../api/tool';

vi.mock('../../api/tool', async () => {
  const actual = await vi.importActual<typeof ToolModule>('../../api/tool');
  return { ...actual, fetchToolDiscovery: vi.fn() };
});

const discoveryMock = vi.mocked(fetchToolDiscovery);

const TOOLS: DiscoveredTool[] = [
  {
    kind: 'builtin',
    name: 'list_tables',
    displayName: 'list_tables',
    description: '列出数据表',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    invocationMode: 'call_tool',
    source: 'BUILTIN',
    serverId: null,
    skillId: null,
  },
  {
    kind: 'mcp',
    name: 'knowledge_lookup',
    displayName: 'knowledge_lookup',
    description: '检索知识库',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '检索词' } },
      required: ['query'],
    },
    readOnly: false,
    invocationMode: 'call_tool',
    source: 'MCP',
    serverId: 3,
    skillId: null,
  },
  {
    kind: 'skill',
    name: 'weekly-report',
    displayName: '周报指引',
    description: '周报写作规范',
    inputSchema: null,
    readOnly: false,
    invocationMode: 'inject_prompt',
    source: 'SKILL',
    serverId: null,
    skillId: 9,
  },
];

describe('ToolPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discoveryMock.mockResolvedValue(TOOLS);
  });

  it('按内置 / MCP / Skill 分组，Skill 只做提示注入不可执行', async () => {
    const user = userEvent.setup();
    render(<ToolPicker onChange={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /选择工具/ }));

    expect(screen.getByText('内置工具')).toBeInTheDocument();
    expect(screen.getByText('MCP 工具')).toBeInTheDocument();
    expect(screen.getByText('Skill（提示注入）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /weekly-report/ })).toBeDisabled();
  });

  it('选择 MCP 工具后按真实 inputSchema 填写参数并回调', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ToolPicker onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: /选择工具/ }));
    await user.click(screen.getByRole('button', { name: /knowledge_lookup/ }));

    expect(screen.getByText('请填写必填参数：query')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/query/), '营收口径');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        selection: { toolName: 'knowledge_lookup', args: { query: '营收口径' } },
        validationError: null,
      });
    });
  });
});
