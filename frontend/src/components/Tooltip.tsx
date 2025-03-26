import React from 'react';
import {
  Tooltip as MuiTooltip,
  TooltipProps as MuiTooltipProps,
  Box,
  Typography,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Success as SuccessIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface TooltipProps extends Omit<MuiTooltipProps, 'title'> {
  title: string;
  description?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  icon?: React.ReactNode;
  content?: React.ReactNode;
  maxWidth?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  arrow?: boolean;
  enterDelay?: number;
  leaveDelay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  title,
  description,
  type = 'info',
  icon,
  content,
  maxWidth = 300,
  placement = 'top',
  arrow = true,
  enterDelay = 200,
  leaveDelay = 0,
  children,
  ...props
}) => {
  const theme = useTheme();

  const getIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'warning':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'success':
        return <SuccessIcon color="success" fontSize="small" />;
      default:
        return <InfoIcon color="info" fontSize="small" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      case 'success':
        return theme.palette.success.main;
      default:
        return theme.palette.info.main;
    }
  };

  const tooltipContent = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Box
        sx={{
          p: 2,
          maxWidth,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: theme.shadows[3],
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: getColor(),
            }}
          >
            {getIcon()}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {title}
            </Typography>
            {description && (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: 'text.secondary',
                }}
              >
                {description}
              </Typography>
            )}
            {content && (
              <Box
                sx={{
                  mt: 1,
                  pt: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                {content}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );

  return (
    <MuiTooltip
      title={tooltipContent}
      placement={placement}
      arrow={arrow}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      {...props}
    >
      {children}
    </MuiTooltip>
  );
};

export default Tooltip; 