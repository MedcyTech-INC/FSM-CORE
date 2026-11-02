import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AttendancePage } from './pages/AttendancePage';
import { VisitsPage } from './pages/VisitsPage';
import { LeavesPage } from './pages/LeavesPage';
import { TasksPage } from './pages/TasksPage';
import { MyTargetsPage } from './features/monthly_target/pages/MyTargetsPage';
import { TargetsListPage } from './features/monthly_target/pages/TargetsListPage';
import { TargetDetailPage } from './features/monthly_target/pages/TargetDetailPage';
import { AlertsDashboardPage } from './features/revenue_leakage/pages/AlertsDashboardPage';
import { AlertDetailPage } from './features/revenue_leakage/pages/AlertDetailPage';
import { RulesConfigPage } from './features/revenue_leakage/pages/RulesConfigPage';
import { ScanRunsPage } from './features/revenue_leakage/pages/ScanRunsPage';

export const App: React.FC = () => {
  const { user, isAuthenticated, loadSession } = useAuthStore();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const isManager = ['ADMIN', 'GM', 'ZSM', 'RSM'].includes(user?.role || '');
  const isSeniorManager = ['ADMIN', 'GM', 'ZSM'].includes(user?.role || '');

  const handleTabChange = (tab: string) => {
    setSelectedTargetId(null);
    setSelectedAlertId(null);
    setCurrentTab(tab);
  };

  return (
    <AppShell currentTab={currentTab} onTabChange={handleTabChange}>
      {currentTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
      {currentTab === 'targets' && (
        <MyTargetsPage
          onNavigateToTeamTargets={() => handleTabChange('team-targets')}
          canManageTargets={isManager}
        />
      )}
      {currentTab === 'team-targets' &&
        (selectedTargetId ? (
          <TargetDetailPage
            targetId={selectedTargetId}
            onBack={() => setSelectedTargetId(null)}
          />
        ) : (
          <TargetsListPage
            onSelectTarget={(id) => setSelectedTargetId(id)}
            onNavigateToMyTargets={() => handleTabChange('targets')}
          />
        ))}
      {currentTab === 'revenue-leakage' &&
        (selectedAlertId ? (
          <AlertDetailPage
            alertId={selectedAlertId}
            onBack={() => setSelectedAlertId(null)}
          />
        ) : (
          <AlertsDashboardPage
            onSelectAlert={(id) => setSelectedAlertId(id)}
            onNavigateToRules={() => handleTabChange('leakage-rules')}
            canConfigureRules={isSeniorManager}
          />
        ))}
      {currentTab === 'leakage-rules' && (
        <RulesConfigPage
          onBack={() => handleTabChange('revenue-leakage')}
          onNavigateToScans={() => handleTabChange('leakage-scans')}
        />
      )}
      {currentTab === 'leakage-scans' && (
        <ScanRunsPage onBack={() => handleTabChange('leakage-rules')} />
      )}
      {currentTab === 'visits' && <VisitsPage />}
      {currentTab === 'attendance' && <AttendancePage />}
      {currentTab === 'leaves' && <LeavesPage />}
      {currentTab === 'tasks' && <TasksPage />}
    </AppShell>
  );
};

export default App;
