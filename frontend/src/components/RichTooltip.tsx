import React from 'react';
import {
  Tooltip,
  TooltipProps,
  Box,
  Typography,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Success as SuccessIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface RichTooltipProps extends Omit<TooltipProps, 'title'> {
  title: string;
  content?: string | React.ReactNode;
  icon?: React.ReactNode;
  type?: 'info' | 'warning' | 'error' | 'success';
  actions?: Array<{
    label: string;
    onClick: () => void;
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  }>;
}

const RichTooltip: React.FC<RichTooltipProps> = ({
  title,
  content,
  icon,
  type = 'info',
  actions = [],
  children,
  ...props
}) => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  const getIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'success':
        return <SuccessIcon color="success" />;
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
          maxWidth: 300,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            mb: content ? 1 : 0,
          }}
        >
          {getIcon()}
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: getColor(),
            }}
          >
            {title}
          </Typography>
        </Box>

        {content && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              ml: 3,
              mb: actions.length > 0 ? 1.5 : 0,
            }}
          >
            {content}
          </Typography>
        )}

        {actions.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              ml: 3,
            }}
          >
            {actions.map((action, index) => (
              <Typography
                key={index}
                component="button"
                variant="caption"
                onClick={action.onClick}
                sx={{
                  color: action.color || 'primary.main',
                  bgcolor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  p: 0,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {action.label}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </motion.div>
  );

  return (
    <Tooltip
      {...props}
      title={tooltipContent}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            '& .MuiTooltip-arrow': {
              color: 'background.paper',
            },
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
};

export default RichTooltip; 