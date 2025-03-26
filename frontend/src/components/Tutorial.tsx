import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon, NavigateNext, NavigateBefore } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../contexts/UIContext';

interface TutorialStep {
  title: string;
  content: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TutorialProps {
  id: string;
  title: string;
  steps: TutorialStep[];
  onComplete?: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ id, title, steps, onComplete }) => {
  const theme = useTheme();
  const { currentTutorial, hideTutorial } = useUI();
  const [activeStep, setActiveStep] = React.useState(0);
  const [targetElement, setTargetElement] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (currentTutorial === id && steps[activeStep].target) {
      const element = document.querySelector(steps[activeStep].target!);
      if (element) {
        setTargetElement(element as HTMLElement);
      }
    }
  }, [currentTutorial, id, activeStep, steps]);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      hideTutorial();
      onComplete?.();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    hideTutorial();
    onComplete?.();
  };

  if (currentTutorial !== id) return null;

  const currentStep = steps[activeStep];
  const position = targetElement
    ? targetElement.getBoundingClientRect()
    : { top: 0, left: 0, width: 0, height: 0 };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Overlay */}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: theme.zIndex.modal + 1,
          }}
        />

        {/* Tutorial Content */}
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            zIndex: theme.zIndex.modal + 2,
            maxWidth: 400,
            p: 3,
            ...(currentStep.placement === 'top' && {
              bottom: window.innerHeight - position.top + 20,
              left: position.left + position.width / 2,
              transform: 'translateX(-50%)',
            }),
            ...(currentStep.placement === 'bottom' && {
              top: position.bottom + 20,
              left: position.left + position.width / 2,
              transform: 'translateX(-50%)',
            }),
            ...(currentStep.placement === 'left' && {
              right: window.innerWidth - position.left + 20,
              top: position.top + position.height / 2,
              transform: 'translateY(-50%)',
            }),
            ...(currentStep.placement === 'right' && {
              left: position.right + 20,
              top: position.top + position.height / 2,
              transform: 'translateY(-50%)',
            }),
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{title}</Typography>
            <IconButton size="small" onClick={handleSkip}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.title}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Typography variant="body1" sx={{ mb: 3 }}>
            {currentStep.content}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<NavigateBefore />}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={activeStep === steps.length - 1 ? null : <NavigateNext />}
            >
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </Paper>
      </motion.div>
    </AnimatePresence>
  );
};

export default Tutorial; 