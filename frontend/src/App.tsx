import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useFeatureStore } from './store/featureStore';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AttendancePage } from './pages/AttendancePage';
import { VisitsPage } from './pages/VisitsPage';
import { LeavesPage } from './pages/LeavesPage';
import { TasksPage } from './pages/TasksPage';
import { ExpensesPage } from './features/expenses';
import { AnalyticsPage } from './features/analytics';

export const App: React.FC = () => {
  const { isAuthenticated, loadSession, user } = useAuthStore();
  const { features, loadFeatures } = useFeatureStore();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  const canViewAnalytics = user?.role === 'ADMIN' || user?.role === 'GM';

  useEffect(() => {
    loadSession();
    loadFeatures();
  }, [loadSession, loadFeatures]);

  // If active tab gets disabled via Setup Wizard or unauthorized role, gracefully fall back to dashboard
  useEffect(() => {
    if (currentTab === 'visits' && !features.field_visits) setCurrentTab('dashboard');
    if (currentTab === 'attendance' && !features.attendance) setCurrentTab('dashboard');
    if (currentTab === 'expenses' && !features.expenses) setCurrentTab('dashboard');
    if (currentTab === 'analytics' && (!features.analytics || !canViewAnalytics)) setCurrentTab('dashboard');
    if (currentTab === 'leaves' && !features.leaves) setCurrentTab('dashboard');
    if (currentTab === 'tasks' && !features.tasks) setCurrentTab('dashboard');
  }, [features, currentTab, canViewAnalytics]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
      {features.field_visits && currentTab === 'visits' && <VisitsPage />}
      {features.attendance && currentTab === 'attendance' && <AttendancePage />}
      {features.expenses && currentTab === 'expenses' && <ExpensesPage />}
      {features.analytics && canViewAnalytics && currentTab === 'analytics' && <AnalyticsPage />}
      {features.leaves && currentTab === 'leaves' && <LeavesPage />}
      {features.tasks && currentTab === 'tasks' && <TasksPage />}
    </AppShell>
  );
};

export default App;
