import { useState, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const getLocation = useCallback((): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const errMsg = 'Geolocation hardware is not supported on this device';
        setState((prev) => ({ ...prev, loading: false, error: errMsg }));
        reject(new Error(errMsg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setState({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            loading: false,
            error: null,
          });
          resolve(coords);
        },
        (err) => {
          const errMsg = err.message || 'Failed to acquire GPS fix';
          setState((prev) => ({ ...prev, loading: false, error: errMsg }));
          reject(new Error(errMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return { ...state, getLocation };
}
