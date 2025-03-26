import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Keyboard as KeyboardIcon,
  Star as StarIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useUI } from '../contexts/UIContext';

const QuickActions: React.FC = () => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { shortcuts, recentWorkflows, favoriteWorkflows } = useUserPreferences();
  const { showTutorial } = useUI();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: string) => {
    handleClose();
    switch (action) {
      case 'search':
        // Implement global search
        break;
      case 'new-workflow':
        // Navigate to new workflow
        break;
      case 'settings':
        // Open settings
        break;
      case 'help':
        showTutorial('main-tutorial');
        break;
      case 'shortcuts':
        // Show shortcuts dialog
        break;
      default:
        break;
    }
  };

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: theme.spacing(2),
          right: theme.spacing(2),
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          zIndex: theme.zIndex.speedDial,
        }}
      >
        <Tooltip title="Quick Actions (Ctrl + Space)" placement="left">
          <IconButton
            color="primary"
            onClick={handleClick}
            sx={{
              bgcolor: 'background.paper',
              boxShadow: 3,
              '&:hover': {
                bgcolor: 'background.paper',
              },
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 300,
            mt: 1,
          },
        }}
      >
        <MenuItem onClick={() => handleAction('search')}>
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Search" secondary="Ctrl + K" />
        </MenuItem>

        <MenuItem onClick={() => handleAction('new-workflow')}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="New Workflow" secondary="Ctrl + N" />
        </MenuItem>

        <Divider />

        {favoriteWorkflows.length > 0 && (
          <>
            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block' }}>
              Favorites
            </Typography>
            {favoriteWorkflows.map((workflowId) => (
              <MenuItem key={workflowId} onClick={() => handleAction(`workflow-${workflowId}`)}>
                <ListItemIcon>
                  <StarIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={`Workflow ${workflowId}`} />
              </MenuItem>
            ))}
            <Divider />
          </>
        )}

        {recentWorkflows.length > 0 && (
          <>
            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block' }}>
              Recent
            </Typography>
            {recentWorkflows.map((workflowId) => (
              <MenuItem key={workflowId} onClick={() => handleAction(`workflow-${workflowId}`)}>
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={`Workflow ${workflowId}`} />
              </MenuItem>
            ))}
            <Divider />
          </>
        )}

        <MenuItem onClick={() => handleAction('settings')}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Settings" secondary="Ctrl + ," />
        </MenuItem>

        <MenuItem onClick={() => handleAction('help')}>
          <ListItemIcon>
            <HelpIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Help & Tutorials" secondary="Ctrl + ?" />
        </MenuItem>

        <MenuItem onClick={() => handleAction('shortcuts')}>
          <ListItemIcon>
            <KeyboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Keyboard Shortcuts" secondary="Ctrl + /" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default QuickActions; 