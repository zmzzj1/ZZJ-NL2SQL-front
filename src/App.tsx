import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DatabasePage } from './pages/DatabasePage';
import { HistoryPage } from './pages/HistoryPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuth } from './hooks/useAuth';
import { useUiPreferences } from './hooks/useUiPreferences';
import { useBackendHealth } from './hooks/useBackendHealth';
import type { WorkspacePageKey } from './types';

/**
 * 应用根组件：服务端 Session 身份、当前页面与 UI 偏好在此组合。
 */
export default function App() {
  const auth = useAuth();
  const { preferences, setTheme, setEditorFontSize, resetPreferences } = useUiPreferences();
  const backendHealth = useBackendHealth();
  const [page, setPage] = useState<WorkspacePageKey>('dashboard');

  if (auth.status === 'checking') {
    return (
      <div className="grid min-h-full place-items-center bg-canvas">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在恢复登录状态…
        </div>
      </div>
    );
  }

  if (auth.status === 'anonymous' || !auth.user) {
    return <LoginPage onLogin={auth.login} onRegister={auth.register} />;
  }

  return (
    <AppShell
      current={page}
      onNavigate={setPage}
      userEmail={auth.user.email}
      onSignOut={() => {
        void auth.signOut();
        setPage('dashboard');
      }}
      backendStatus={backendHealth.status}
      onRecheckHealth={backendHealth.recheck}
    >
      {page === 'dashboard' ? (
        <DashboardPage fontSize={preferences.editorFontSize} onGoToDatabase={() => setPage('database')} />
      ) : null}
      {page === 'database' ? <DatabasePage /> : null}
      {page === 'history' ? <HistoryPage fontSize={preferences.editorFontSize} /> : null}
      {page === 'knowledge' ? <KnowledgePage /> : null}
      {page === 'settings' ? (
        <SettingsPage
          preferences={preferences}
          onThemeChange={setTheme}
          onFontSizeChange={setEditorFontSize}
          onReset={resetPreferences}
        />
      ) : null}
    </AppShell>
  );
}
