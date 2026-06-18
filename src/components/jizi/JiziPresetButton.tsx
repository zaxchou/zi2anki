import React, { useState } from 'react';
import {
  Box,
  Button,
  Popover,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';

/** 预设分类 */
interface PresetCategory {
  label: string;
  items: string[];
}

const PRESETS: PresetCategory[] = [
  {
    label: '诗文',
    items: [
      '春江花月夜',
      '静夜思',
      '登鹳雀楼',
      '清明',
      '水调歌头',
      '将进酒',
      '江雪',
      '望庐山瀑布',
      '枫桥夜泊',
      '出塞',
    ],
  },
  {
    label: '对联',
    items: [
      '海纳百川有容乃大',
      '厚德载物自强不息',
      '书山有路勤为径',
      '天道酬勤',
      '宁静致远',
      '淡泊明志',
      '上善若水',
      '知行合一',
    ],
  },
  {
    label: '名言',
    items: [
      '温故而知新',
      '学而时习之',
      '见贤思齐',
      '博学笃志',
      '三人行必有我师',
      '己所不欲勿施于人',
      '天行健君子以自强不息',
      '地势坤君子以厚德载物',
    ],
  },
];

export interface JiziPresetButtonProps {
  onSelect: (text: string) => void;
}

/** 诗文预设按钮 + Popover 选择 */
const JiziPresetButton: React.FC<JiziPresetButtonProps> = ({ onSelect }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleSelect = (item: string) => {
    onSelect(item);
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={<AutoStoriesIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ textTransform: 'none', fontSize: 12 }}
      >
        预设
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxWidth: 360, p: 1.5 } } }}
      >
        {PRESETS.map((cat, ci) => (
          <Box key={cat.label}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {cat.label}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, mb: ci < PRESETS.length - 1 ? 1 : 0 }}>
              {cat.items.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  size="small"
                  variant="outlined"
                  onClick={() => handleSelect(item)}
                  sx={{ fontSize: 11 }}
                />
              ))}
            </Box>
            {ci < PRESETS.length - 1 && <Divider sx={{ my: 1 }} />}
          </Box>
        ))}
      </Popover>
    </>
  );
};

export default JiziPresetButton;
