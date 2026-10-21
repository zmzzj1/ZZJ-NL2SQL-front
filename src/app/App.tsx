import { BootstrapScreen } from './BootstrapScreen';
import { WorkspaceShell } from './WorkspaceShell';
import { LoginPage } from '../pages/LoginPage';
import { useAuth } from '../hooks/useAuth';

/**
 * 应用根组件：只做身份门禁与组合分发。
 * 初始化加载态与登录页在此分流，已登录后交给 WorkspaceShell。
 */
export default function App() {
  const auth = useAuth();

  if (auth.status === 'checking') {
    return <BootstrapScreen />;
  }

  if (auth.status === 'anonymous' || !auth.user) {
    return <LoginPage onLogin={auth.login} onRegister={auth.register} />;
  }

  return <WorkspaceShell user={auth.user} signOut={auth.signOut} />;
}
