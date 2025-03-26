import React, { useState, useEffect } from 'react';
import { Box, Grid, Container, useTheme, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stepper, Step, StepLabel } from '@mui/material';
import { styled } from '@mui/material/styles';
import CostOptimization from './sections/CostOptimization';
import WorkflowAutomation from './sections/WorkflowAutomation';
import SecurityAlerts from './sections/SecurityAlerts';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';

const DashboardContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: '64px',
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

const OnboardingGuide: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    {
      label: 'Welcome to AetherIQ',
      content: 'Let\'s get you started with our AI-powered workflow optimization platform.'
    },
    {
      label: 'Performance Overview',
      content: 'Monitor your workflow performance metrics and get AI-driven insights.'
    },
    {
      label: 'Automation',
      content: 'Set up automated workflows and let AI optimize them for you.'
    },
    {
      label: 'Security',
      content: 'Keep your workflows secure with our advanced encryption and monitoring.'
    }
  ];

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Welcome to AetherIQ</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <Typography variant="body1" paragraph>
          {steps[activeStep].content}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleBack} disabled={activeStep === 0}>
          Back
        </Button>
        <Button onClick={handleNext} variant="contained" color="primary">
          {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if this is the first visit
    const hasVisited = localStorage.getItem('hasVisited');
    if (!hasVisited) {
      setShowOnboarding(true);
      localStorage.setItem('hasVisited', 'true');
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <DashboardContainer>
      <DashboardHeader onSidebarToggle={toggleSidebar} />
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <MainContent>
        <Container maxWidth="xl">
          <Grid container spacing={3}>
            {/* Cost Optimization Section */}
            <Grid item xs={12} md={8}>
              <CostOptimization />
            </Grid>
            
            {/* Security Alerts Section */}
            <Grid item xs={12} md={4}>
              <SecurityAlerts />
            </Grid>
            
            {/* Workflow Automation Section */}
            <Grid item xs={12}>
              <WorkflowAutomation />
            </Grid>
          </Grid>
        </Container>
      </MainContent>
      <OnboardingGuide open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </DashboardContainer>
  );
};

export default DashboardLayout; 