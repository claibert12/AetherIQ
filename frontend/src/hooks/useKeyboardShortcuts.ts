import { useEffect, useCallback } from 'react';
import { useUI } from '../contexts/UIContext';
import { useUserPreferences } from './useUserPreferences';

interface ShortcutHandler {
  key: string;
  description: string;
  handler: () => void;
}

export const useKeyboardShortcuts = () => {
  const { showNotification, showTutorial } = useUI();
  const { shortcuts, setShortcuts } = useUserPreferences();

  const registerShortcut = useCallback(
    (shortcut: ShortcutHandler) => {
      setShortcuts((prev) => [...prev, shortcut]);
    },
    [setShortcuts]
  );

  const unregisterShortcut = useCallback(
    (key: string) => {
      setShortcuts((prev) => prev.filter((s) => s.key !== key));
    },
    [setShortcuts]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check for registered shortcuts
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keys = shortcut.key.toLowerCase().split('+').map((k) => k.trim());
        const pressedKeys = [];

        if (event.ctrlKey) pressedKeys.push('ctrl');
        if (event.shiftKey) pressedKeys.push('shift');
        if (event.altKey) pressedKeys.push('alt');
        if (event.metaKey) pressedKeys.push('meta');

        // Add the main key if it's not a modifier
        const mainKey = event.key.toLowerCase();
        if (!['control', 'shift', 'alt', 'meta'].includes(mainKey)) {
          pressedKeys.push(mainKey);
        }

        return keys.every((k) => pressedKeys.includes(k));
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  // Register default shortcuts
  useEffect(() => {
    // Navigation shortcuts
    registerShortcut({
      key: 'Ctrl + K',
      description: 'Global Search',
      handler: () => {
        // Implement global search
        showNotification('Global search triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + N',
      description: 'New Workflow',
      handler: () => {
        // Navigate to new workflow
        showNotification('New workflow triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + ,',
      description: 'Settings',
      handler: () => {
        // Open settings
        showNotification('Settings triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + ?',
      description: 'Help & Tutorials',
      handler: () => {
        showTutorial('main-tutorial');
      },
    });

    // Workflow shortcuts
    registerShortcut({
      key: 'Ctrl + S',
      description: 'Save Workflow',
      handler: () => {
        // Save current workflow
        showNotification('Workflow saved', 'success');
      },
    });

    registerShortcut({
      key: 'Ctrl + R',
      description: 'Run Workflow',
      handler: () => {
        // Run current workflow
        showNotification('Workflow running', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + Z',
      description: 'Undo',
      handler: () => {
        // Undo last action
        showNotification('Undo triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + Y',
      description: 'Redo',
      handler: () => {
        // Redo last action
        showNotification('Redo triggered', 'info');
      },
    });

    // View shortcuts
    registerShortcut({
      key: 'Ctrl + +',
      description: 'Zoom In',
      handler: () => {
        // Zoom in
        showNotification('Zoom in triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + -',
      description: 'Zoom Out',
      handler: () => {
        // Zoom out
        showNotification('Zoom out triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + 0',
      description: 'Reset Zoom',
      handler: () => {
        // Reset zoom
        showNotification('Reset zoom triggered', 'info');
      },
    });

    registerShortcut({
      key: 'Ctrl + F',
      description: 'Toggle Fullscreen',
      handler: () => {
        // Toggle fullscreen
        showNotification('Fullscreen toggled', 'info');
      },
    });

    // Cleanup shortcuts on unmount
    return () => {
      shortcuts.forEach((shortcut) => unregisterShortcut(shortcut.key));
    };
  }, [registerShortcut, unregisterShortcut, showNotification, showTutorial]);

  return {
    registerShortcut,
    unregisterShortcut,
    shortcuts,
  };
};

export default useKeyboardShortcuts; 