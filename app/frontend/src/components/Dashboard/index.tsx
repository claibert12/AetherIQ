import React from 'react';
import { Box, Container, Grid, Paper, Typography } from '@mui/material';
import WorkflowPerformance from './sections/WorkflowPerformance';
import WorkflowLogs from './sections/WorkflowLogs';
import SecurityAlerts from './sections/SecurityAlerts';

const Dashboard: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h4" component="h1" gutterBottom>
              AetherIQ Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              AI Workflow Optimization System
            </Typography>
          </Paper>
        </Grid>

        {/* Workflow Performance */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <WorkflowPerformance />
          </Paper>
        </Grid>

        {/* Workflow Logs */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <WorkflowLogs />
          </Paper>
        </Grid>

        {/* Security Alerts */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <SecurityAlerts />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 