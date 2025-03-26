import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItemSecondaryAction,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LoopIcon from '@mui/icons-material/Loop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { DASHBOARD_CONFIG } from '../../../config';
import { useWorkflowData } from '../../../hooks/useWorkflowData';
import { formatDate, formatDuration } from '../../../utils/formatters';
import { OptimizationSuggestion } from '../../../api/workflow';

const WorkflowAutomation: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const { logs, isLoading, error, optimizeWorkflow, isOptimizing } = useWorkflowData({ timeRange });
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);

  // Sample automation tasks - in a real app, this would come from an API
  const automationTasks = [
    { id: 1, name: 'Data Processing', status: 'active', schedule: 'Every 4 hours', lastRun: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, name: 'Report Generation', status: 'scheduled', schedule: 'Daily at 00:00', lastRun: new Date(Date.now() - 86400000).toISOString() },
    { id: 3, name: 'Model Training', status: 'completed', schedule: 'Weekly on Sunday', lastRun: new Date(Date.now() - 259200000).toISOString() },
    { id: 4, name: 'Maintenance Task', status: 'failed', schedule: 'Monthly on 1st', lastRun: new Date(Date.now() - 432000000).toISOString() },
  ];

  const handleOptimize = async (taskId: number) => {
    setSelectedTask(taskId);
    try {
      const response = await optimizeWorkflow(taskId.toString());
      setSuggestions(response?.suggestions || []);
      setShowOptimizationDialog(true);
    } catch (error) {
      console.error('Failed to get optimization suggestions:', error);
    }
  };

  const handleApplyOptimization = async () => {
    if (!selectedTask) return;
    try {
      await optimizeWorkflow(selectedTask.toString());
      setShowOptimizationDialog(false);
    } catch (error) {
      console.error('Failed to apply optimization:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayArrowIcon color="primary" />;
      case 'scheduled':
        return <LoopIcon color="action" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <WarningIcon color="error" />;
      default:
        return null;
    }
  };

  const getStatusChip = (status: string) => {
    const color = status === 'active' ? 'primary' : 
                 status === 'completed' ? 'success' : 
                 status === 'failed' ? 'error' : 'default';
    return <Chip label={status} color={color} size="small" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Failed to load workflow automation data</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Workflow Automation</Typography>
          <FormControl size="small" sx={{ width: 120 }}>
            <InputLabel id="automation-time-range-label">Time Range</InputLabel>
            <Select
              labelId="automation-time-range-label"
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value as string)}
            >
              {Object.entries(DASHBOARD_CONFIG.timeRanges).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>Automated Tasks</Typography>
            <List>
              {automationTasks.map((task) => (
                <React.Fragment key={task.id}>
                  <ListItem
                    secondaryAction={
                      <Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AutoFixHighIcon />}
                          disabled={isOptimizing || task.status === 'active'}
                          onClick={() => handleOptimize(task.id)}
                          sx={{ mr: 1 }}
                        >
                          {isOptimizing ? <CircularProgress size={20} /> : 'AI Optimize'}
                        </Button>
                      </Box>
                    }
                  >
                    <ListItemIcon>{getStatusIcon(task.status)}</ListItemIcon>
                    <ListItemText
                      primary={task.name}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2">Schedule: {task.schedule}</Typography>
                          <Typography variant="body2">Last run: {formatDate(task.lastRun)}</Typography>
                          <Box sx={{ mt: 1 }}>{getStatusChip(task.status)}</Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>Recent Activity</Typography>
            <List dense>
              {logs ? (
                logs.slice(0, 5).map((log) => (
                  <ListItem key={log.id}>
                    <ListItemText
                      primary={log.message}
                      secondary={formatDate(log.timestamp)}
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        fontWeight: log.level === 'error' ? 'bold' : 'normal'
                      }}
                    />
                    <Chip 
                      label={log.level.toUpperCase()} 
                      color={log.level === 'error' ? 'error' : log.level === 'warning' ? 'warning' : 'info'}
                      size="small"
                    />
                  </ListItem>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No recent activity</Typography>
              )}
            </List>
          </Grid>
        </Grid>
      </CardContent>

      <Dialog open={showOptimizationDialog} onClose={() => setShowOptimizationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Optimization Suggestions</DialogTitle>
        <DialogContent>
          <List>
            {suggestions.map((suggestion, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <AutoFixHighIcon color={suggestion.priority === 'high' ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={suggestion.description}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2">{suggestion.suggestion}</Typography>
                      <Typography variant="body2" color="primary">
                        Potential Savings: {suggestion.potential_savings}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOptimizationDialog(false)}>Cancel</Button>
          <Button onClick={handleApplyOptimization} variant="contained" color="primary">
            Apply Optimizations
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default WorkflowAutomation; 