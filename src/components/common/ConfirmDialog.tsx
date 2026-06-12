import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

export interface ConfirmDialogProps {
  /** 对话框是否可见 */
  open: boolean;
  /** 对话框标题 */
  title: string;
  /** 提示消息 */
  message: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 通用确认对话框。
 * 确认按钮为红色（error），取消按钮为灰色。
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          取消
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" autoFocus>
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
