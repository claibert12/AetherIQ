import React from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';

interface LoadingStateProps {
  title?: string;
  message?: string;
  type?: 'circular' | 'linear';
  size?: number;
  thickness?: number;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  fullWidth?: boolean;
  fullHeight?: boolean;
  overlay?: boolean;
  children?: React.ReactNode;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  title,
  message,
  type = 'circular',
  size = 40,
  thickness = 3.6,
  color = 'primary',
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
        {type === 'circular' ? (
          <CircularProgress
            size={size}
            thickness={thickness}
            color={color}
            sx={{
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': {
                  transform: 'rotate(0deg)',
                },
                '100%': {
                  transform: 'rotate(360deg)',
                },
              },
            }}
          />
        ) : (
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            <LinearProgress
              color={color}
              sx={{
                height: thickness,
                borderRadius: thickness / 2,
                bgcolor: theme.palette[color].light,
                '& .MuiLinearProgress-bar': {
                  borderRadius: thickness / 2,
                },
              }}
            />
          </Box>
        )}

        {(title || message) && (
          <Box sx={{ textAlign: 'center' }}>
            {title && (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>
            )}
            {message && (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: 'text.secondary',
                }}
              >
                {message}
              </Typography>
            )}
          </Box>
        )}
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

export default LoadingState; 