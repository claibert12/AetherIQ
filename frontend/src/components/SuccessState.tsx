import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface SuccessStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  onGoBack?: () => void;
  fullWidth?: boolean;
  fullHeight?: boolean;
  overlay?: boolean;
  children?: React.ReactNode;
}

const SuccessState: React.FC<SuccessStateProps> = ({
  title = 'Success!',
  message = 'The operation completed successfully.',
  onRetry,
  onGoHome,
  onGoBack,
  fullWidth = false,
  fullHeight = false,
  overlay = false,
  children,
}) => {
  const theme = useTheme();

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    p: 3,
    ...(fullWidth && { width: '100%' }),
    ...(fullHeight && { height: '100%' }),
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Box sx={containerStyle}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
            delay: 0.1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: theme.palette.success.light,
              color: theme.palette.success.main,
              mb: 2,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 32 }} />
          </Box>
        </motion.div>

        <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              color: 'text.secondary',
            }}
          >
            {message}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mt: 2,
          }}
        >
          {onGoBack && (
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={onGoBack}
            >
              Go Back
            </Button>
          )}
          {onRetry && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={onRetry}
            >
              Try Again
            </Button>
          )}
          {onGoHome && (
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={onGoHome}
            >
              Go Home
            </Button>
          )}
        </Box>

        {children}
      </Box>
    </motion.div>
  );

  if (overlay) {
    return (
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: theme.zIndex.modal,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: theme.shadows[3],
          }}
        >
          {content}
        </Paper>
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: theme.shadows[3],
      }}
    >
      {content}
    </Paper>
  );
};

export default SuccessState; 