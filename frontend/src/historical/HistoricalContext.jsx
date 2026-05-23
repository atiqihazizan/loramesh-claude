// Historical context: shares the query selection between the
// sidebar (form) and the page (content). Provided by HistoricalLayout.

import { createContext, useContext, useState, useMemo } from 'react';

const HistoricalContext = createContext(null);

export function HistoricalProvider({ children }) {
  // The "submitted" query — set only when the user clicks View.
  // null until the first valid submit.
  const [query, setQuery] = useState(null);

  const value = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <HistoricalContext.Provider value={value}>
      {children}
    </HistoricalContext.Provider>
  );
}

export function useHistoricalContext() {
  const ctx = useContext(HistoricalContext);
  if (!ctx) {
    throw new Error('useHistoricalContext must be used within HistoricalProvider');
  }
  return ctx;
}
