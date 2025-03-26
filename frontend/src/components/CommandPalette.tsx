import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useUI } from '../contexts/UIContext';
import Fuse from 'fuse.js';

interface Command {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commands, setCommands] = useState<Command[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const { shortcuts } = useKeyboardShortcuts();
  const { recentWorkflows, favoriteWorkflows } = useUserPreferences();
  const { showNotification, showTutorial } = useUI();

  // Initialize commands
  useEffect(() => {
    const allCommands: Command[] = [
      // Navigation
      {
        id: 'search',
        name: 'Search',
        description: 'Search across all workflows and files',
        icon: <SearchIcon />,
        shortcut: 'Ctrl + K',
        category: 'Navigation',
        action: () => {
          showNotification('Search triggered', 'info');
          onClose();
        },
      },
      {
        id: 'new-workflow',
        name: 'New Workflow',
        description: 'Create a new workflow',
        shortcut: 'Ctrl + N',
        category: 'Navigation',
        action: () => {
          showNotification('New workflow triggered', 'info');
          onClose();
        },
      },
      {
        id: 'settings',
        name: 'Settings',
        description: 'Open application settings',
        shortcut: 'Ctrl + ,',
        category: 'Navigation',
        action: () => {
          showNotification('Settings triggered', 'info');
          onClose();
        },
      },
      {
        id: 'help',
        name: 'Help & Tutorials',
        description: 'Show help and tutorials',
        shortcut: 'Ctrl + ?',
        category: 'Navigation',
        action: () => {
          showTutorial('main-tutorial');
          onClose();
        },
      },

      // Recent Workflows
      ...recentWorkflows.map((workflowId) => ({
        id: `recent-${workflowId}`,
        name: `Open Workflow ${workflowId}`,
        description: 'Open a recently used workflow',
        category: 'Recent',
        action: () => {
          showNotification(`Opening workflow ${workflowId}`, 'info');
          onClose();
        },
      })),

      // Favorite Workflows
      ...favoriteWorkflows.map((workflowId) => ({
        id: `favorite-${workflowId}`,
        name: `Open Workflow ${workflowId}`,
        description: 'Open a favorite workflow',
        category: 'Favorites',
        action: () => {
          showNotification(`Opening workflow ${workflowId}`, 'info');
          onClose();
        },
      })),

      // All registered shortcuts
      ...shortcuts.map((shortcut) => ({
        id: `shortcut-${shortcut.key}`,
        name: shortcut.description,
        description: `Trigger ${shortcut.description}`,
        shortcut: shortcut.key,
        category: 'Shortcuts',
        action: () => {
          shortcut.handler();
          onClose();
        },
      })),
    ];

    setCommands(allCommands);
  }, [shortcuts, recentWorkflows, favoriteWorkflows, showNotification, showTutorial, onClose]);

  // Filter commands based on search
  useEffect(() => {
    if (!search) {
      setFilteredCommands(commands);
      return;
    }

    const fuse = new Fuse(commands, {
      keys: ['name', 'description', 'category'],
      threshold: 0.3,
      includeScore: true,
    });

    const results = fuse.search(search);
    setFilteredCommands(results.map((result) => result.item));
    setSelectedIndex(0);
  }, [search, commands]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          mt: 8,
          maxHeight: '80vh',
          borderRadius: 2,
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon color="action" />
          <TextField
            fullWidth
            variant="standard"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              disableUnderline: true,
              sx: { fontSize: '1.1rem' },
            }}
          />
          <Tooltip title="Close (Esc)">
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <List
          ref={listRef}
          sx={{
            maxHeight: '60vh',
            overflow: 'auto',
            p: 0,
          }}
        >
          {filteredCommands.map((command, index) => (
            <ListItem
              key={command.id}
              button
              selected={index === selectedIndex}
              onClick={() => {
                command.action();
                onClose();
              }}
              sx={{
                py: 1.5,
                px: 2,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {command.icon || <KeyboardIcon />}
              </ListItemIcon>
              <ListItemText
                primary={command.name}
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {command.description}
                    </Typography>
                    {command.shortcut && (
                      <Typography
                        variant="caption"
                        sx={{
                          bgcolor: 'action.selected',
                          px: 1,
                          py: 0.5,
                          borderRadius: 0.5,
                          fontFamily: 'monospace',
                        }}
                      >
                        {command.shortcut}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>

        {filteredCommands.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No commands found matching "{search}"
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette; 