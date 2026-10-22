import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Wrench, X } from 'lucide-react';
import { fetchTools } from '../../api/tool';
import type { ToolDescriptor } from '../../api/contract';

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

function propertiesOf(schema: Record<string, unknown>): Record<string, SchemaProperty> {
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') return {};
  return properties as Record<string, SchemaProperty>;
}

function requiredOf(schema: Record<string, unknown>): string[] {
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
 * P14-A：Agent 输入框的 `/` 工具选择。候选来自服务端 `GET /api/v1/tools` 目录，
 * 仅在用户点击发送后才把 toolInvocation 提交给后端；后端仍是最终验证方。
 */
export function ToolPicker({ disabled = false, onChange }: ToolPickerProps) {
  const [tools, setTools] = useState<ToolDescriptor[]>([]);
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
    void (async () => {
      try {
        const catalog = await fetchTools();
        if (!active) return;
        setTools(catalog);
        setLoadError(null);
      } catch {
        if (!active) return;
        setLoadError('工具目录加载失败');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(() => tools.find((tool) => tool.name === toolName) ?? null, [tools, toolName]);

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

  const pick = (name: string) => {
    const tool = tools.find((item) => item.name === name);
    setToolName(name);
    setOpen(false);
    const next: Record<string, string> = {};
    if (tool) {
      for (const [key, property] of Object.entries(propertiesOf(tool.inputSchema))) {
        next[key] = initialValue(property.type);
      }
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
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line bg-panel-muted p-2">
          {tools.length === 0 ? (
            <li className="text-[11px] text-ink-muted">当前没有可用工具</li>
          ) : (
            tools.map((tool) => (
              <li key={tool.name}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-accent-soft"
                  onClick={() => pick(tool.name)}
                  disabled={disabled}
                >
                  <span className="font-mono text-ink">{tool.name}</span>
                  <span className="truncate text-ink-muted">{tool.description}</span>
                </button>
              </li>
            ))
          )}
        </ul>
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
