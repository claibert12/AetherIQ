import React from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  title: string;
  message: string;
  illustration?: React.ReactNode;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'contained' | 'outlined' | 'text';
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  }>;
  fullScreen?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  illustration,
  actions = [],
  fullScreen = false,
}) => {
  const theme = useTheme();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  const illustrationVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: 0.2,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const containerSx = fullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'background.paper',
        zIndex: theme.zIndex.modal,
      }
    : {
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 200,
      };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...containerSx,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing(3),
          }}
        >
          <motion.div variants={illustrationVariants}>
            {illustration || (
              <FolderIcon
                sx={{
                  fontSize: 80,
                  color: 'primary.main',
                  opacity: 0.8,
                }}
              />
            )}
          </motion.div>

          <motion.div variants={contentVariants}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{
                fontWeight: 600,
              }}
            >
              {title}
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 400,
                mb: 3,
              }}
            >
              {message}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'contained'}
                  color={action.color || 'primary'}
                  startIcon={action.icon}
                  onClick={action.onClick}
                  sx={{
                    minWidth: 160,
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          </motion.div>
        </Box>
      </Paper>
    </motion.div>
  );
};

export default EmptyState; 