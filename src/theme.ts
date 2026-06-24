import type { ThemeOptions } from '@mui/material';

/**
 * Shadow 层级系统（Vercel 式 "shadow-as-border"）
 * shadowBorder 替代 border: 1px，避免圆角裁剪。
 */
export const shadowBorder = '0px 0px 0px 1px rgba(0,0,0,0.08)';
export const shadowBorderDark = '0px 0px 0px 1px rgba(255,255,255,0.12)';
export const shadowCard = '0px 0px 0px 1px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.06)';
export const shadowCardDark = '0px 0px 0px 1px rgba(255,255,255,0.12), 0px 1px 2px rgba(0,0,0,0.3)';
export const shadowElevated = '0px 0px 0px 1px rgba(0,0,0,0.08), 0px 4px 12px rgba(0,0,0,0.08)';
export const shadowElevatedDark = '0px 0px 0px 1px rgba(255,255,255,0.12), 0px 4px 12px rgba(0,0,0,0.4)';

export function getShadowBorder(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? shadowBorderDark : shadowBorder;
}

export function getShadowCard(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? shadowCardDark : shadowCard;
}

export function getShadowElevated(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? shadowElevatedDark : shadowElevated;
}

export function buildThemeOptions(resolvedMode: 'light' | 'dark'): ThemeOptions {
  const sb = resolvedMode === 'dark' ? shadowBorderDark : shadowBorder;

  return {
    palette: {
      mode: resolvedMode,
      primary: {
        main: resolvedMode === 'dark' ? '#63d4cb' : '#3eb5a8',
      },
      secondary: {
        main: resolvedMode === 'dark' ? '#8eddd6' : '#66c9bf',
      },
      background: {
        default: resolvedMode === 'dark' ? '#121212' : '#f5f5f0',
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
      h1: { fontFamily: '"Noto Serif SC", "楷体", KaiTi, serif' },
      h2: { fontFamily: '"Noto Serif SC", "楷体", KaiTi, serif' },
      h3: { fontFamily: '"Noto Serif SC", "楷体", KaiTi, serif' },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            // border 颜色基调（配合 shadow-as-border 的 1px 0.08 黑）
            '--border-color': resolvedMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none', // 去掉 MUI 默认的覆盖层
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: sb,
            overflow: 'visible',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            transition: 'all 0.15s ease',
            fontWeight: 500,
          },
          sizeSmall: { fontSize: 12, padding: '4px 12px' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontSize: 12,
            height: 28,
          },
          sizeSmall: {
            fontSize: 11,
            height: 24,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            boxShadow: sb,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: sb,
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            boxShadow: sb,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            padding: '4px 12px',
            fontSize: 12,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { backgroundColor: 'primary.dark' },
              '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            paddingLeft: '16px !important',
            paddingRight: '16px !important',
            minHeight: '48px !important',
            '@media (min-width: 600px)': {
              minHeight: '48px !important',
            },
          },
        },
      },
    },
  };
}
