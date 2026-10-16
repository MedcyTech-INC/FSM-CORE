import { useState, useCallback } from 'react';

export function useCamera() {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const capturePhotoFromFile = useCallback((file: File): Promise<string> => {
    setIsProcessing(true);
    setError(null);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result as string;
        // In compliance with arch.pdf, images are processed and encoded as Base64 strings
        setPhotoBase64(result);
        setIsProcessing(false);
        resolve(result);
      };

      reader.onerror = () => {
        const err = 'Failed to read image data from camera';
        setError(err);
        setIsProcessing(false);
        reject(new Error(err));
      };

      reader.readAsDataURL(file);
    });
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoBase64(null);
    setError(null);
  }, []);

  return { photoBase64, isProcessing, error, capturePhotoFromFile, clearPhoto };
}
