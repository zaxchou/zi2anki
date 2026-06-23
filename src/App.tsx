import { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, useMediaQuery } from '@mui/material';
import { useSettingsStore } from '@/stores/useSettingsStore';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import StudyPage from '@/pages/StudyPage';
import DecksPage from '@/pages/DecksPage';
import CardManagePage from '@/pages/CardManagePage';
import SettingsPage from '@/pages/SettingsPage';
import UserManagePage from '@/pages/UserManagePage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import MarketPage from '@/pages/MarketPage';
import JiziPage from '@/pages/JiziPage';
import NotFoundPage from '@/pages/NotFoundPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function App() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const resolvedMode: 'light' | 'dark' =
    darkMode === 'dark'
      ? 'dark'
      : darkMode === 'system'
        ? (prefersDark ? 'dark' : 'light')
        : 'light';

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: {
            main: resolvedMode === 'dark' ? '#63d4cb' : '#3eb5a8',
          },
          secondary: {
            main: resolvedMode === 'dark' ? '#8eddd6' : '#66c9bf',
          },
          background: {
            default: resolvedMode === 'dark' ? '#121212' : '#f0faf9',
            paper: resolvedMode === 'dark' ? '#1e1e1e' : '#ffffff',
          },
        },
        typography: {
          fontFamily: [
            '"Noto Sans SC"',
            '"Microsoft YaHei"',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
          ].join(','),
          h1: {
            fontFamily: '"Noto Serif SC", "楷体", KaiTi, serif',
          },
          h2: {
            fontFamily: '"Noto Serif SC", "楷体", KaiTi, serif',
          },
          h3: {
            fontFamily: '"Noto Serif SC", "楷体", KaiTi, serif',
          },
        },
        shape: {
          borderRadius: 12,
        },
      }),
    [resolvedMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* 集字公开访问（不需要登录） */}
          <Route element={<AppShell />}>
            <Route path="/jizi" element={<JiziPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/study/:deckId" element={<StudyPage />} />
              <Route path="/decks" element={<DecksPage />} />
              <Route path="/decks/:deckId/cards" element={<CardManagePage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/users" element={<UserManagePage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
