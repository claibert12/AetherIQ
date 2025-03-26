import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  Paper,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Maximize as MaximizeIcon,
  Minimize as MinimizeIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  fullScreen?: boolean;
  onFullScreen?: () => void;
  hideCloseButton?: boolean;
  hideTitle?: boolean;
  hideActions?: boolean;
  paperProps?: React.ComponentProps<typeof Paper>;
  contentProps?: React.ComponentProps<typeof DialogContent>;
  titleProps?: React.ComponentProps<typeof DialogTitle>;
  actionsProps?: React.ComponentProps<typeof DialogActions>;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  fullScreen = false,
  onFullScreen,
  hideCloseButton = false,
  hideTitle = false,
  hideActions = false,
  paperProps,
  contentProps,
  titleProps,
  actionsProps,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  const handleClose = (event: React.SyntheticEvent, reason?: string) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth={maxWidth}
          fullWidth={fullWidth}
          fullScreen={fullScreen || isMobile}
          PaperComponent={motion.div}
          PaperProps={{
            initial: { opacity: 0, scale: 0.95, y: 20 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.95, y: 20 },
            transition: { duration: 0.2 },
            ...paperProps,
          }}
          sx={{
            '& .MuiDialog-paper': {
              borderRadius: 2,
              overflow: 'hidden',
            },
            ...paperProps?.sx,
          }}
        >
          {!hideTitle && (
            <DialogTitle
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1,
                ...titleProps?.sx,
              }}
              {...titleProps}
            >
              <Box>
                {title && (
                  <Typography variant="h6" component="div">
                    {title}
                  </Typography>
                )}
                {subtitle && (
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {subtitle}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {onFullScreen && (
                  <IconButton
                    size="small"
                    onClick={onFullScreen}
                    sx={{
                      color: 'action.active',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    {fullScreen ? <MinimizeIcon /> : <MaximizeIcon />}
                  </IconButton>
                )}
                {!hideCloseButton && (
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
                    <CloseIcon />
                  </IconButton>
                )}
              </Box>
            </DialogTitle>
          )}

          <Divider />

          <DialogContent
            sx={{
              p: 3,
              ...contentProps?.sx,
            }}
            {...contentProps}
          >
            {children}
          </DialogContent>

          {!hideActions && actions && (
            <>
              <Divider />
              <DialogActions
                sx={{
                  p: 2,
                  ...actionsProps?.sx,
                }}
                {...actionsProps}
              >
                {actions}
              </DialogActions>
            </>
          )}
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default Modal; 