import React from 'react';
import {
  Box,
  TextField,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider,
} from '@mui/material';
import type { JiziLayout, JiziDirection, JiziBackground } from '@/types/jizi';

export interface JiziInputPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  layout: JiziLayout;
  onLayoutChange: (layout: JiziLayout) => void;
}

/** 输入区 + 排版控件 */
const JiziInputPanel: React.FC<JiziInputPanelProps> = ({
  text,
  onTextChange,
  layout,
  onLayoutChange,
}) => {
  const update = (patch: Partial<JiziLayout>) => onLayoutChange({ ...layout, ...patch });

  return (
    <Stack spacing={2.5}>
      {/* 文字输入 */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          集字内容
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="输入诗句，如：春江潮水连海平"
          variant="outlined"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          支持中文汉字，标点自动忽略，最多 200 字
        </Typography>
      </Box>

      <Divider />

      {/* 排版方向 */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          方向
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={layout.direction}
          onChange={(_, v: JiziDirection | null) => v && update({ direction: v })}
        >
          <ToggleButton value="vertical-rl">竖排⇦</ToggleButton>
          <ToggleButton value="vertical-lr">竖排⇨</ToggleButton>
          <ToggleButton value="horizontal-lr">横排⇩</ToggleButton>
          <ToggleButton value="horizontal-rl">横排⇧</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 字号 */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          字号
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={layout.fontSize}
          onChange={(_, v: number | null) => v && update({ fontSize: v })}
        >
          <ToggleButton value={80}>小</ToggleButton>
          <ToggleButton value={120}>中</ToggleButton>
          <ToggleButton value={160}>大</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 列字数 */}
      <FormControl size="small" fullWidth>
        <InputLabel>{layout.direction.startsWith('vertical') ? '每列字数' : '每行字数'}</InputLabel>
        <Select
          value={layout.colCount}
          label={layout.direction.startsWith('vertical') ? '每列字数' : '每行字数'}
          onChange={(e) => update({ colCount: Number(e.target.value) })}
        >
          <MenuItem value={4}>4 字</MenuItem>
          <MenuItem value={6}>6 字</MenuItem>
          <MenuItem value={8}>8 字</MenuItem>
        </Select>
      </FormControl>

      {/* 字距 */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          字距
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            size="small"
            min={0}
            max={0.4}
            step={0.02}
            value={layout.charGap}
            onChange={(_, v) => update({ charGap: v as number })}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
          />
        </Box>
      </Box>

      {/* 行距 */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          行距
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            size="small"
            min={0}
            max={0.6}
            step={0.02}
            value={layout.lineGap}
            onChange={(_, v) => update({ lineGap: v as number })}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
          />
        </Box>
      </Box>

      {/* 背景 */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          背景
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={layout.background}
          onChange={(_, v: JiziBackground | null) => v && update({ background: v })}
        >
          <ToggleButton value="xuan">宣纸</ToggleButton>
          <ToggleButton value="white">纯白</ToggleButton>
          <ToggleButton value="ink">墨色</ToggleButton>
          <ToggleButton value="vermilion">朱砂</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Stack>
  );
};

export default JiziInputPanel;
