import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  useTheme,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface ProgressIndicatorProps {
  title: string;
  progress: number;
  status?: 'running' | 'paused' | 'completed' | 'error';
  message?: string;
  onClose?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  showClose?: boolean;
  variant?: 'determinate' | 'indeterminate';
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  fullWidth?: boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  title,
  progress,
  status = 'running',
  message,
  onClose,
  onPause,
  onResume,
  showClose = true,
  variant = 'determinate',
  color = 'primary',
  fullWidth = false,
}) => {
  const theme = useTheme();

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'paused':
        return <PauseIcon color="action" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'paused':
        return theme.palette.action.disabled;
      default:
        return theme.palette[color].main;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          width: fullWidth ? '100%' : 'auto',
          minWidth: 300,
          maxWidth: 500,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1,
          }}
        >
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: getStatusColor(),
              }}
            >
              {title}
            </Typography>
            {getStatusIcon()}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {status === 'running' && onPause && (
              <IconButton
                size="small"
                onClick={onPause}
                sx={{
                  color: 'action.active',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <PauseIcon fontSize="small" />
              </IconButton>
            )}
            {status === 'paused' && onResume && (
              <IconButton
                size="small"
                onClick={onResume}
                sx={{
                  color: 'action.active',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            )}
            {showClose && onClose && (
              <IconButton
                size="small"
                onClick={onClose}
                sx={{
                  color: 'action.active',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        <Box sx={{ mb: message ? 1 : 0 }}>
          <LinearProgress
            variant={variant}
            value={progress}
            color={color}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
              },
            }}
          />
        </Box>

        {message && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {message}
          </Typography>
        )}

        {variant === 'determinate' && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              textAlign: 'right',
              mt: 0.5,
            }}
          >
            {Math.round(progress)}%
          </Typography>
        )}
      </Paper>
    </motion.div>
  );
};

export default ProgressIndicator; 