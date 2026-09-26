import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { subscribe } from '../lib/db';

const DataContext = createContext({ version: 0, refresh: () => {} });

/**
 * Sumber kebenaran tunggal untuk data lokal.
 * Setiap perubahan database menaikkan `version` sehingga seluruh hook
 * yang memakainya ikut menghitung ulang (reactive).
 */
export function DataProvider({ children }) {
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(() => ({ version, refresh }), [version, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData harus dipakai di dalam <DataProvider>.');
  return ctx;
}

export default DataContext;
