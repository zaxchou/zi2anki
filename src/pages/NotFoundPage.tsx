import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

/**
 * 404 页面未找到。
 * 大号 404 文字 + 返回 Zi2Anki按钮。
 */
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <Typography
        variant="h1"
        className="font-kai mb-4"
        color="text.disabled"
        sx={{ fontSize: '8rem', lineHeight: 1, opacity: 0.4 }}
      >
        404
      </Typography>
      <Typography variant="h5" className="font-kai mb-2" color="text.secondary">
        页面未找到
      </Typography>
      <Typography variant="body2" color="text.disabled" className="mb-8 max-w-xs">
        你访问的页面不存在或已被移除，请检查网址是否正确。
      </Typography>
      <Button
        variant="contained"
        size="large"
        startIcon={<HomeIcon />}
        onClick={() => navigate('/dashboard')}
      >
        返回 背字帖
      </Button>
    </Box>
  );
};

export default NotFoundPage;
