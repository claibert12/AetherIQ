import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  useTheme,
} from '@mui/material';
import { Keyboard as KeyboardIcon } from '@mui/icons-material';

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { key: 'Ctrl + K', description: 'Global Search', category: 'Navigation' },
  { key: 'Ctrl + N', description: 'New Workflow', category: 'Navigation' },
  { key: 'Ctrl + ,', description: 'Settings', category: 'Navigation' },
  { key: 'Ctrl + ?', description: 'Help & Tutorials', category: 'Navigation' },
  { key: 'Ctrl + /', description: 'Show Shortcuts', category: 'Navigation' },
  
  // Workflow
  { key: 'Ctrl + S', description: 'Save Workflow', category: 'Workflow' },
  { key: 'Ctrl + R', description: 'Run Workflow', category: 'Workflow' },
  { key: 'Ctrl + Z', description: 'Undo', category: 'Workflow' },
  { key: 'Ctrl + Y', description: 'Redo', category: 'Workflow' },
  
  // View
  { key: 'Ctrl + +', description: 'Zoom In', category: 'View' },
  { key: 'Ctrl + -', description: 'Zoom Out', category: 'View' },
  { key: 'Ctrl + 0', description: 'Reset Zoom', category: 'View' },
  { key: 'Ctrl + F', description: 'Toggle Fullscreen', category: 'View' },
  
  // Editor
  { key: 'Tab', description: 'Indent', category: 'Editor' },
  { key: 'Shift + Tab', description: 'Unindent', category: 'Editor' },
  { key: 'Ctrl + /', description: 'Toggle Comment', category: 'Editor' },
  { key: 'Ctrl + D', description: 'Select Next Occurrence', category: 'Editor' },
];

const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ open, onClose }) => {
  const theme = useTheme();
  
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyboardIcon color="primary" />
        <Typography variant="h6">Keyboard Shortcuts</Typography>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3}>
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <Grid item xs={12} md={6} key={category}>
              <Typography
                variant="subtitle2"
                color="primary"
                sx={{ mb: 1, fontWeight: 600 }}
              >
                {category}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {categoryShortcuts.map((shortcut) => (
                  <Box
                    key={shortcut.key}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 1,
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <Typography variant="body2">{shortcut.description}</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        fontFamily: 'monospace',
                        bgcolor: 'action.selected',
                        px: 1,
                        py: 0.5,
                        borderRadius: 0.5,
                      }}
                    >
                      {shortcut.key}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShortcutsDialog; 