import { ChatPanel } from '../features/sql-workspace/ChatPanel';
import { ResultPanel } from '../features/sql-workspace/ResultPanel';
import { SqlPanel } from '../features/sql-workspace/SqlPanel';
import { useSqlWorkspace } from '../features/sql-workspace/useSqlWorkspace';

interface DashboardPageProps {
  fontSize: number;
}

/**
 * SQL 工作台页面：只负责组合功能区块。
 * 生成/执行状态机在 useSqlWorkspace，展示分别由 ChatPanel、SqlPanel、ResultPanel 承担。
 */
export function DashboardPage({ fontSize }: DashboardPageProps) {
  const workspace = useSqlWorkspace();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:h-full lg:flex-row">
      <ChatPanel
        messages={workspace.messages}
        input={workspace.input}
        generating={workspace.generation.status === 'streaming'}
        canSend={workspace.canSend}
        onInputChange={workspace.setInput}
        onSend={workspace.sendMessage}
        onCancel={workspace.cancelGeneration}
        onClear={workspace.clearAll}
      />

      <section
        aria-label="SQL 与结果预览"
        className="flex min-w-0 flex-col gap-4 lg:h-full lg:w-[58%] lg:overflow-y-auto"
      >
        <SqlPanel
          generation={workspace.generation}
          canExecute={workspace.canExecute}
          executing={workspace.execution.status === 'running'}
          sqlLooksReadOnly={workspace.sqlLooksReadOnly}
          canRetry={workspace.canRetryGeneration}
          fontSize={fontSize}
          onExecute={() => void workspace.runQuery()}
          onRetry={workspace.retryGeneration}
        />
        <ResultPanel execution={workspace.execution} onRetry={() => void workspace.runQuery()} />

        <p className="rounded-xl border border-line bg-panel-muted px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
          数据源：本地演示库 <span className="font-mono">sql_demo</span>（只读账号）· 模型输出不会自动执行 ·
          界面不展示数据库凭据或模型密钥。
        </p>
      </section>
    </div>
  );
}
