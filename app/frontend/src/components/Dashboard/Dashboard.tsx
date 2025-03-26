import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper,
  useTheme,
} from '@mui/material';
import WorkflowPerformance from './sections/WorkflowPerformance';
import WorkflowLogs from './sections/WorkflowLogs';
import SecurityAlerts from './sections/SecurityAlerts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const theme = useTheme();
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
      sx={{
        backgroundColor: theme.palette.background.paper
      }}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

interface DashboardProps {}

export const Dashboard: React.FC<DashboardProps> = () => {
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const theme = useTheme();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setSelectedTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h4" gutterBottom>
            AI-Driven Workflow Dashboard
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={selectedTab}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Performance Overview" />
              <Tab label="Workflow Logs" />
              <Tab label="Security Alerts" />
            </Tabs>

            <TabPanel value={selectedTab} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <WorkflowPerformance />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={selectedTab} index={1}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <WorkflowLogs />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={selectedTab} index={2}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <SecurityAlerts />
                </Grid>
              </Grid>
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}; 