import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

interface UIContextType {
  showNotification: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  showTutorial: (tutorialId: string) => void;
  hideTutorial: () => void;
  isCompactMode: boolean;
  toggleCompactMode: () => void;
  currentTutorial: string | null;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<{
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);
  const [loading, setLoading] = useState<{ message?: string } | null>(null);
  const [currentTutorial, setCurrentTutorial] = useState<string | null>(null);
  const { compactMode, toggleCompactMode } = useUserPreferences();

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({ message, severity });
  };

  const showLoading = (message?: string) => {
    setLoading({ message });
  };

  const hideLoading = () => {
    setLoading(null);
  };

  const showTutorial = (tutorialId: string) => {
    setCurrentTutorial(tutorialId);
  };

  const hideTutorial = () => {
    setCurrentTutorial(null);
  };

  // Handle keyboard shortcuts for common actions
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideTutorial();
        hideLoading();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <UIContext.Provider
      value={{
        showNotification,
        showLoading,
        hideLoading,
        showTutorial,
        hideTutorial,
        isCompactMode: compactMode,
        toggleCompactMode,
        currentTutorial,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification(null)}
          severity={notification?.severity}
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>

      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: 'blur(4px)',
        }}
        open={!!loading}
      >
        <CircularProgress color="inherit" />
        {loading?.message && (
          <div style={{ marginTop: '1rem', color: '#fff' }}>{loading.message}</div>
        )}
      </Backdrop>
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}; 