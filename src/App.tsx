import { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DatabasePage } from './pages/DatabasePage';
import { HistoryPage } from './pages/HistoryPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { useDemoSession } from './hooks/useDemoSession';
import { useUiPreferences } from './hooks/useUiPreferences';
import { useBackendHealth } from './hooks/useBackendHealth';
import type { WorkspacePageKey } from './types';

/**
 * 应用根组件：演示会话与 UI 偏好提升到最近的共同父级，
 * 页面本身只处理自己的局部状态。
 */
export default function App() {
  const { session, signIn, signOut } = useDemoSession();
  const { preferences, setTheme, setEditorFontSize, resetPreferences } = useUiPreferences();
  const backendHealth = useBackendHealth();
  const [page, setPage] = useState<WorkspacePageKey>('dashboard');

  if (!session) {
    return <LoginPage onSignIn={signIn} />;
  }

  return (
    <AppShell
      current={page}
      onNavigate={setPage}
      userEmail={session.email}
      onSignOut={() => {
        signOut();
        setPage('dashboard');
      }}
      backendStatus={backendHealth.status}
      onRecheckHealth={backendHealth.recheck}
    >
      {page === 'dashboard' ? <DashboardPage fontSize={preferences.editorFontSize} /> : null}
      {page === 'database' ? <DatabasePage /> : null}
      {page === 'history' ? <HistoryPage fontSize={preferences.editorFontSize} /> : null}
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
