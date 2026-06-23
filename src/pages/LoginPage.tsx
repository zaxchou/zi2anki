import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Link, Alert,
  CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { FormControlLabel, Checkbox } from '@mui/material';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, authConfig, fetchConfig } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // 页面挂载时查询系统状态，判断是否为空数据库
  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password, rememberMe);
      navigate(from, { replace: true });
    } catch {
      // error 已由 store 保存
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }} elevation={8}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontFamily: '"Noto Serif SC", serif', mb: 0.5 }}>
              {'\u{1F58B}'} 背字帖
            </Typography>
            <Typography variant="body2" color="text.secondary">
              书法记忆卡
            </Typography>
          </Box>

          {authConfig && !authConfig.hasUsers && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>欢迎使用 背字帖</strong><br />
                系统中还没有用户，请先{' '}
                <Link component={RouterLink} to="/register" underline="hover">
                  注册
                </Link>{' '}
                第一个管理员账号来开始使用。
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              autoComplete="username"
              autoFocus
              disabled={isLoading}
            />
            <TextField
              fullWidth
              label="密码"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              autoComplete="current-password"
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="body2">记住我</Typography>}
              sx={{ mt: 0.5 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || !username || !password}
              sx={{ mt: 1, mb: 1.5, py: 1.2 }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : '登录'}
            </Button>
          </Box>

          <Typography variant="body2" align="center" color="text.secondary">
            没有账号？{' '}
            <Link component={RouterLink} to="/register" underline="hover">
              注册
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
