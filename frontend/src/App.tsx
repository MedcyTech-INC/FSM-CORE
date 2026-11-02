import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AttendancePage } from './pages/AttendancePage';
import { VisitsPage } from './pages/VisitsPage';
import { LeavesPage } from './pages/LeavesPage';
import { TasksPage } from './pages/TasksPage';
import { LeadsPage } from './lead_management';
import { FollowupsPage } from './followups';

export const App: React.FC = () => {
  const { isAuthenticated, loadSession } = useAuthStore();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
      {currentTab === 'visits' && <VisitsPage />}
      {currentTab === 'attendance' && <AttendancePage />}
      {currentTab === 'leaves' && <LeavesPage />}
      {currentTab === 'tasks' && <TasksPage />}
      {currentTab === 'leads' && <LeadsPage />}
      {currentTab === 'followups' && <FollowupsPage />}
    </AppShell>
  );
};

export default App;
