import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Wrench, X } from 'lucide-react';
import { fetchToolDiscovery } from '../../api/tool';
import type { DiscoveredTool, ToolKind } from '../../api/contract';
import { MCP_CATALOG_CHANGED_EVENT } from './toolCatalog';

/** 当前选中的工具与已填写参数。 */
export interface ToolSelection {
  toolName: string;
  args: Record<string, unknown>;
}

/** 工具选择器的完整状态：选择结果 + 参数是否填齐。 */
export interface ToolPickerState {
  selection: ToolSelection | null;
  /** 参数未填齐时的提示；null 表示可以发送。 */
  validationError: string | null;
}

interface ToolPickerProps {
  disabled?: boolean;
  onChange: (state: ToolPickerState) => void;
}

interface SchemaProperty {
  type?: string;
  description?: string;
}

const GROUP_LABEL: Record<ToolKind, string> = {
  builtin: '内置工具',
  mcp: 'MCP 工具',
  skill: 'Skill（提示注入）',
};

const GROUP_ORDER: ToolKind[] = ['builtin', 'mcp', 'skill'];

function propertiesOf(schema: Record<string, unknown> | null): Record<string, SchemaProperty> {
  if (!schema) return {};
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') return {};
  return properties as Record<string, SchemaProperty>;
}

function requiredOf(schema: Record<string, unknown> | null): string[] {
  if (!schema) return [];
  const required = schema.required;
  if (!Array.isArray(required)) return [];
  return required.filter((item): item is string => typeof item === 'string');
}

function initialValue(type: string | undefined): string {
  if (type === 'number' || type === 'integer') return '';
  if (type === 'boolean') return 'false';
  return '';
}

function coerce(value: string, type: string | undefined): unknown {
  if (type === 'number' || type === 'integer') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  if (type === 'boolean') return value === 'true';
  return value;
}

/**
 * P14-A/P14-E：Agent 输入框的 `/` 工具选择。候选来自用户级统一目录
 * `GET /api/v1/tools/discovery`，按内置 / MCP / Skill 分组。
 *
 * <p>只有 `call_tool` 条目可被选为单次工具调用；Skill 是提示注入
 * （`inject_prompt`），由既有 Skill 渲染链路消费，绝不伪装成 MCP `tools/call`。
 * 参数表单来自服务端返回的真实 `inputSchema`，后端仍是最终校验方。</p>
 */
export function ToolPicker({ disabled = false, onChange }: ToolPickerProps) {
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [toolName, setToolName] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const catalog = await fetchToolDiscovery();
        if (!active) return;
        setTools(catalog);
        setLoadError(null);
      } catch {
        if (!active) return;
        setLoadError('工具目录加载失败');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    // MCP 连接/断开/删除后重新拉取真实目录，不让已断开的工具继续留在候选里。
    const onCatalogChanged = () => {
      void load();
    };
    window.addEventListener(MCP_CATALOG_CHANGED_EVENT, onCatalogChanged);
    return () => {
      active = false;
      window.removeEventListener(MCP_CATALOG_CHANGED_EVENT, onCatalogChanged);
    };
  }, []);

  const selectable = useMemo(() => tools.filter((tool) => tool.invocationMode === 'call_tool'), [tools]);

  const selected = useMemo(() => selectable.find((tool) => tool.name === toolName) ?? null, [selectable, toolName]);

  // 选中项在目录刷新后消失（例如 MCP 已断开）：立即清空，避免提交已失效的工具。
  useEffect(() => {
    if (toolName !== null && selected === null && !loading) {
      setToolName(null);
      setValues({});
    }
  }, [loading, selected, toolName]);

  const required = useMemo(() => (selected ? requiredOf(selected.inputSchema) : []), [selected]);

  const validationError = useMemo(() => {
    if (!selected) return null;
    const missing = required.filter((name) => {
      const value = values[name];
      return value == null || String(value).trim().length === 0;
    });
    if (missing.length > 0) return `请填写必填参数：${missing.join('、')}`;
    return null;
  }, [selected, required, values]);

  useEffect(() => {
    if (!selected) {
      onChangeRef.current({ selection: null, validationError: null });
      return;
    }
    const args: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(values)) {
      const property = propertiesOf(selected.inputSchema)[name];
      if (String(value).trim().length === 0) continue;
      args[name] = coerce(value, property?.type);
    }
    onChangeRef.current({ selection: { toolName: selected.name, args }, validationError });
  }, [selected, values, validationError]);

  const pick = (tool: DiscoveredTool) => {
    setToolName(tool.name);
    setOpen(false);
    const next: Record<string, string> = {};
    for (const [key, property] of Object.entries(propertiesOf(tool.inputSchema))) {
      next[key] = initialValue(property.type);
    }
    setValues(next);
  };

  const clear = () => {
    setToolName(null);
    setValues({});
    setOpen(false);
  };

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        正在加载工具目录…
      </p>
    );
  }

  if (loadError) {
    return <p className="text-[11px] text-ink-muted">{loadError}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-muted px-2 py-1 text-[11px]"
          onClick={() => setOpen((value) => !value)}
          disabled={disabled}
          aria-expanded={open}
        >
          <Wrench className="h-3 w-3" aria-hidden="true" />
          选择工具
        </button>
        {selected ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            {selected.kind === 'mcp' ? <span className="text-[10px] uppercase">MCP</span> : null}
            {selected.name}
            <button type="button" onClick={clear} aria-label="取消工具选择" className="ml-0.5">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span className="text-[11px] text-ink-muted">选择后将跳过复杂度分析，单次调用该工具（需服务端授权）</span>
        )}
      </div>

      {open ? (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-line bg-panel-muted p-2">
          {selectable.length === 0 ? (
            <p className="text-[11px] text-ink-muted">当前没有可用工具</p>
          ) : (
            GROUP_ORDER.map((kind) => {
              const group = tools.filter((tool) => tool.kind === kind);
              if (group.length === 0) return null;
              return (
                <section key={kind} aria-label={GROUP_LABEL[kind]}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {GROUP_LABEL[kind]}
                  </p>
                  <ul className="space-y-1">
                    {group.map((tool) => {
                      const runnable = tool.invocationMode === 'call_tool';
                      return (
                        <li key={`${tool.kind}-${tool.serverId ?? 'local'}-${tool.name}`}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                            onClick={() => pick(tool)}
                            disabled={disabled || !runnable}
                            title={runnable ? tool.description : 'Skill 只做提示注入，不作为单次工具调用执行'}
                          >
                            <span className="font-mono text-ink">{tool.name}</span>
                            <span className="truncate text-ink-muted">
                              {runnable ? tool.description : '提示注入（不执行工具）'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      ) : null}

      {selected ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(propertiesOf(selected.inputSchema)).map(([name, property]) => {
            const isRequired = required.includes(name);
            const inputId = `tool-arg-${selected.name}-${name}`;
            return (
              <label key={name} className="flex flex-col gap-1 text-[11px] text-ink-muted" htmlFor={inputId}>
                <span className="font-mono text-ink">
                  {name}
                  {isRequired ? <span className="text-danger"> *</span> : null}
                  {property.description ? ` · ${property.description}` : ''}
                </span>
                {property.type === 'boolean' ? (
                  <select
                    id={inputId}
                    className="input-field py-1"
                    value={values[name] ?? 'false'}
                    onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                    disabled={disabled}
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : (
                  <input
                    id={inputId}
                    className="input-field py-1"
                    value={values[name] ?? ''}
                    inputMode={property.type === 'number' || property.type === 'integer' ? 'numeric' : 'text'}
                    placeholder={property.type ?? 'string'}
                    onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                    disabled={disabled}
                  />
                )}
              </label>
            );
          })}
          {Object.keys(propertiesOf(selected.inputSchema)).length === 0 ? (
            <p className="text-[11px] text-ink-muted">该工具无需参数。</p>
          ) : null}
        </div>
      ) : null}

      {validationError ? (
        <p role="alert" className="text-[11px] text-danger">
          {validationError}
        </p>
      ) : null}
    </div>
  );
}
