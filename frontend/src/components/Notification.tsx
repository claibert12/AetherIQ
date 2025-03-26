import React from 'react';
import {
  Snackbar,
  Alert,
  AlertColor,
  IconButton,
  Box,
  Typography,
  Button,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Success as SuccessIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationProps {
  open: boolean;
  message: string;
  type?: AlertColor;
  title?: string;
  description?: string;
  duration?: number;
  onClose: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  }>;
}

const Notification: React.FC<NotificationProps> = ({
  open,
  message,
  type = 'info',
  title,
  description,
  duration = 6000,
  onClose,
  actions = [],
}) => {
  const theme = useTheme();

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <WarningIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'success':
        return <SuccessIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.3 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Alert
          onClose={onClose}
          severity={type}
          variant="filled"
          sx={{
            minWidth: { xs: '100%', sm: 400 },
            maxWidth: { xs: '100%', sm: 400 },
            boxShadow: theme.shadows[8],
            '& .MuiAlert-icon': {
              fontSize: 28,
              opacity: 0.9,
            },
          }}
        >
          <Box sx={{ width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: description ? 1 : 0,
              }}
            >
              <Box sx={{ flex: 1 }}>
                {title && (
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    {title}
                  </Typography>
                )}
                <Typography variant="body2">{message}</Typography>
              </Box>
              <IconButton
                size="small"
                onClick={onClose}
                sx={{
                  color: 'inherit',
                  opacity: 0.7,
                  '&:hover': {
                    opacity: 1,
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {description && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  opacity: 0.8,
                  mb: actions.length > 0 ? 1.5 : 0,
                }}
              >
                {description}
              </Typography>
            )}

            {actions.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                }}
              >
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    size="small"
                    variant="text"
                    color={action.color || 'inherit'}
                    onClick={action.onClick}
                    sx={{
                      minWidth: 'auto',
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Box>
            )}
          </Box>
        </Alert>
      </motion.div>
    </Snackbar>
  );
};

export default Notification; 