import { useEffect, useState } from 'react';

/**
 * Menunda perubahan value — dipakai untuk search agar query tidak
 * dijalankan pada setiap ketikan.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
