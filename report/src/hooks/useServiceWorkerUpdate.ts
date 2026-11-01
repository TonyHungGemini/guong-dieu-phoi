import { useState, useEffect } from 'react';
import { APP_VERSION, VERSION_STORAGE_KEY, migrateData } from '../lib/version';

export function useServiceWorkerUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    // 1. Check version in localStorage & run data migration on launch
    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    if (storedVersion !== APP_VERSION) {
      migrateData(storedVersion, APP_VERSION).then(() => {
        if (storedVersion) {
          setJustUpdated(true);
        }
      });
    }

    // 2. Service Worker Detection & Event Listening
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      
      let refreshing = false;
      const onControllerChange = () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      // Check registration
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        // If a service worker is waiting, prompt user
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setHasUpdate(true);
        }

        // Listen for updates being installed
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setHasUpdate(true);
              }
            });
          }
        });
      });

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      };
    }
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Safe reload
      window.location.reload();
    }
  };

  // Demo / Simulation mode for testing update banner UI
  const triggerSimulatedUpdate = () => {
    setHasUpdate(true);
  };

  return {
    hasUpdate,
    isUpdating,
    justUpdated,
    setJustUpdated,
    handleUpdate,
    triggerSimulatedUpdate
  };
}
