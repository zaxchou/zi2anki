import { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import StudyPage from '@/pages/StudyPage';
import DecksPage from '@/pages/DecksPage';
import CardManagePage from '@/pages/CardManagePage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

function App() {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: {
            main: '#5c4033',
          },
          secondary: {
            main: '#8d6e63',
          },
          background: {
            default: '#faf8f5',
            paper: '#ffffff',
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
    []
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/study/:deckId" element={<StudyPage />} />
            <Route path="/decks" element={<DecksPage />} />
            <Route path="/decks/:deckId/cards" element={<CardManagePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
