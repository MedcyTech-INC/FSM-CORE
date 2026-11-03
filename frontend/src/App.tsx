import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useFeatureStore } from './store/featureStore';
import { useTenantStore } from './store/tenantStore';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AttendancePage } from './pages/AttendancePage';
import { VisitsPage } from './pages/VisitsPage';
import { LeavesPage } from './pages/LeavesPage';
import { TasksPage } from './pages/TasksPage';
import { LeadsPage } from './lead_management';
import { FollowupsPage } from './followups';
import { ExpensesPage } from './features/expenses';
import { AnalyticsPage } from './features/analytics';
import { MyTargetsPage } from './features/monthly_target/pages/MyTargetsPage';
import { TargetsListPage } from './features/monthly_target/pages/TargetsListPage';
import { TargetDetailPage } from './features/monthly_target/pages/TargetDetailPage';
import { AlertsDashboardPage } from './features/revenue_leakage/pages/AlertsDashboardPage';
import { AlertDetailPage } from './features/revenue_leakage/pages/AlertDetailPage';
import { RulesConfigPage } from './features/revenue_leakage/pages/RulesConfigPage';
import { ScanRunsPage } from './features/revenue_leakage/pages/ScanRunsPage';
import { PlatformSuperAdminPage } from './pages/PlatformSuperAdminPage';

export const App: React.FC = () => {
  const { user, isAuthenticated, loadSession } = useAuthStore();
  const { features, loadFeatures } = useFeatureStore();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [showSuperAdmin, setShowSuperAdmin] = useState<boolean>(false);

  const canViewAnalytics = user?.role === 'ADMIN' || user?.role === 'GM';
  const isManager = ['ADMIN', 'GM', 'ZSM', 'RSM'].includes(user?.role || '');
  const isSeniorManager = ['ADMIN', 'GM', 'ZSM'].includes(user?.role || '');

  const { loadTenantContext } = useTenantStore();

  useEffect(() => {
    loadSession();
    loadFeatures();
    loadTenantContext();
  }, [loadSession, loadFeatures, loadTenantContext]);

  // If active tab gets disabled via Setup Wizard or unauthorized role, gracefully fall back to dashboard
  useEffect(() => {
    if (currentTab === 'visits' && !features.field_visits) setCurrentTab('dashboard');
    if (currentTab === 'attendance' && !features.attendance) setCurrentTab('dashboard');
    if (currentTab === 'expenses' && !features.expenses) setCurrentTab('dashboard');
    if (currentTab === 'analytics' && (!features.analytics || !canViewAnalytics)) setCurrentTab('dashboard');
    if (currentTab === 'leaves' && !features.leaves) setCurrentTab('dashboard');
    if (currentTab === 'tasks' && !features.tasks) setCurrentTab('dashboard');
    if (currentTab === 'leads' && !features.leads) setCurrentTab('dashboard');
    if (currentTab === 'followups' && !features.followups) setCurrentTab('dashboard');
  }, [features, currentTab, canViewAnalytics]);

  const handleTabChange = (tab: string) => {
    setSelectedTargetId(null);
    setSelectedAlertId(null);
    setCurrentTab(tab);
  };

  if (showSuperAdmin || user?.role === 'SUPER_ADMIN') {
    return (
      <PlatformSuperAdminPage
        onBackToApp={() => setShowSuperAdmin(false)}
        onSelectTenant={(_slug) => {
          setShowSuperAdmin(false);
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onOpenSuperAdmin={() => setShowSuperAdmin(true)} />;
  }

  return (
    <AppShell currentTab={currentTab} onTabChange={handleTabChange}>
      {currentTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
      {currentTab === 'daily-plan' && <DailyPlanPage />}
      {features.leads && currentTab === 'leads' && <LeadsPage />}
      {features.followups && currentTab === 'followups' && <FollowupsPage />}
      {features.expenses && currentTab === 'expenses' && <ExpensesPage />}
      {features.analytics && canViewAnalytics && currentTab === 'analytics' && <AnalyticsPage />}

      {/* Monthly Targets Module */}
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

      {/* Revenue Leakage Detection Module */}
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

      {/* Field Operations & Attendance */}
      {features.field_visits && currentTab === 'visits' && <VisitsPage />}
      {features.attendance && currentTab === 'attendance' && <AttendancePage />}
      {features.leaves && currentTab === 'leaves' && <LeavesPage />}
      {features.tasks && currentTab === 'tasks' && <TasksPage />}

      {/* Platform Super-Admin Control Plane */}
      {currentTab === 'platform-admin' && (
        <PlatformSuperAdminPage onBackToApp={() => handleTabChange('dashboard')} />
      )}
    </AppShell>
  );
};

export default App;
