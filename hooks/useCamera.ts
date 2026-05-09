import { useCallback, useEffect, useRef, useState } from 'react';

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  
  const start = useCallback(async (constraints?: MediaStreamConstraints) => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: constraints?.video || { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
        ...constraints
      });
      streamRef.current = s;
      setStream(s);
      setIsActive(true);
      return s;
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError' ? 'دسترسی به دوربین رد شد. لطفاً اجازه دهید.' :
                 err.name === 'NotFoundError' ? 'دوربین یافت نشد.' :
                 err.name === 'NotReadableError' ? 'دوربین توسط برنامه دیگری استفاده می‌شود.' :
                 `خطای دوربین: ${err.message}`;
      setError(msg);
      setIsActive(false);
      throw err;
    }
  }, []);
  
  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsActive(false);
  }, []);
  
  // Auto-stop on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);
  
  return { stream, error, isActive, start, stop };
}
