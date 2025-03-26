import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '../../../utils/formatters';
import { fetchSecurityAlerts } from '../../../api/security';
import { SecurityAlert } from '../../../api/security';

const SecurityAlerts: React.FC = () => {
  // Fetch security alerts
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['securityAlerts'],
    queryFn: fetchSecurityAlerts,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <ErrorIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'compliance':
        return <SecurityIcon color="primary" />;
      case 'anomaly':
        return <WarningIcon color="warning" />;
      case 'threat':
        return <ErrorIcon color="error" />;
      default:
        return <WarningIcon />;
    }
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
          <Alert severity="error">Failed to load security alerts</Alert>
        </CardContent>
      </Card>
    );
  }

  const activeAlerts = alerts?.filter(alert => alert.status === 'active') || [];
  const resolvedAlerts = alerts?.filter(alert => alert.status === 'resolved') || [];

  return (
    <Card>
      <CardHeader
        title="Security & Compliance"
        subheader="Real-time security monitoring"
        action={
          <Tooltip title="Refresh alerts">
            <IconButton>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          {/* Security Status Summary */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h6" color="error.main">
                  {activeAlerts.filter(a => a.severity === 'high').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  High Severity
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h6" color="warning.main">
                  {activeAlerts.filter(a => a.severity === 'medium').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Medium Severity
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h6" color="success.main">
                  {resolvedAlerts.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Resolved
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Active Alerts */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Active Alerts
            </Typography>
            <List>
              {activeAlerts.map((alert: SecurityAlert) => (
                <React.Fragment key={alert.id}>
                  <ListItem>
                    <ListItemIcon>
                      {getAlertIcon(alert.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {alert.title}
                          </Typography>
                          <Chip
                            label={alert.severity}
                            color={getSeverityColor(alert.severity)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {alert.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(alert.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
              {activeAlerts.length === 0 && (
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="No active alerts"
                    secondary="All systems are secure"
                  />
                </ListItem>
              )}
            </List>
          </Grid>

          {/* Recently Resolved Alerts */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Recently Resolved
            </Typography>
            <List>
              {resolvedAlerts.slice(0, 3).map((alert: SecurityAlert) => (
                <React.Fragment key={alert.id}>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.title}
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          Resolved {formatDateTime(alert.timestamp)}
                        </Typography>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default SecurityAlerts; 