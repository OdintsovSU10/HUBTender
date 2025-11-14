import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Nomenclatures from './pages/Admin/Nomenclatures/Nomenclatures';
import Tenders from './pages/Admin/Tenders/Tenders';
import ConstructionCost from './pages/Admin/ConstructionCost/ConstructionCost';
import MarkupConstructor from './pages/Admin/MarkupConstructor/MarkupConstructor';
import MarkupPercentages from './pages/Admin/MarkupPercentages/MarkupPercentages';
import Library from './pages/Library';
import Templates from './pages/Library/Templates';
import './App.css';

// Временный импорт для тестирования Supabase (удалить после проверки)
import './test-supabase';

function AppContent() {
  const { theme: currentTheme } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#10b981',
          colorSuccess: '#159957',
          colorInfo: '#0891b2',
        },
      }}
    >
      <AntApp>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="positions" element={<div>Позиции заказчика</div>} />
            <Route path="commerce" element={<div>Коммерция</div>} />
            <Route path="library" element={<Library />} />
            <Route path="library/templates" element={<Templates />} />
            <Route path="costs" element={<div>Затраты на строительство</div>} />
            <Route path="admin">
              <Route index element={<Navigate to="/admin/nomenclatures" replace />} />
              <Route path="nomenclatures" element={<Nomenclatures />} />
              <Route path="tenders" element={<Tenders />} />
              <Route path="construction_cost" element={<ConstructionCost />} />
              <Route path="markup_constructor" element={<MarkupConstructor />} />
              <Route path="markup" element={<MarkupPercentages />} />
            </Route>
            <Route path="users" element={<div>Пользователи</div>} />
            <Route path="settings" element={<div>Настройки</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App