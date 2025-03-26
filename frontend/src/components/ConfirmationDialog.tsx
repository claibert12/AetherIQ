import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  description?: string;
  type?: 'warning' | 'error' | 'info' | 'help';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  cancelColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  confirmVariant?: 'contained' | 'outlined' | 'text';
  cancelVariant?: 'contained' | 'outlined' | 'text';
  confirmIcon?: React.ReactNode;
  cancelIcon?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  title,
  message,
  description,
  type = 'warning',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmColor = 'primary',
  cancelColor = 'inherit',
  confirmVariant = 'contained',
  cancelVariant = 'outlined',
  confirmIcon,
  cancelIcon,
  maxWidth = 'sm',
}) => {
  const theme = useTheme();

  const getIcon = () => {
    if (confirmIcon) return confirmIcon;
    switch (type) {
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'help':
        return <HelpIcon color="info" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      case 'help':
        return theme.palette.info.main;
      default:
        return theme.palette.info.main;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 1,
            pr: 6,
          }}
        >
          {getIcon()}
          <Typography variant="h6" component="span">
            {title}
          </Typography>
          <IconButton
            onClick={onCancel}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body1" gutterBottom>
              {message}
            </Typography>
            {description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                {description}
              </Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            gap: 1,
          }}
        >
          <Button
            variant={cancelVariant}
            color={cancelColor}
            onClick={onCancel}
            startIcon={cancelIcon}
            sx={{
              minWidth: 100,
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            color={confirmColor}
            onClick={onConfirm}
            startIcon={confirmIcon}
            sx={{
              minWidth: 100,
            }}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </motion.div>
    </Dialog>
  );
};

export default ConfirmationDialog; 