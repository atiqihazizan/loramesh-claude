// Historical area layout (TopBar + historical sidebar + outlet).
// Wrapped in HistoricalProvider to share query selection.
// E6-responsive — sidebar jadi drawer pada mobile.

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import HistoricalSidebar from '../../historical/HistoricalSidebar.jsx';
import ResponsiveDrawer from './ResponsiveDrawer.jsx';
import { HistoricalProvider } from '../../historical/HistoricalContext.jsx';

export default function HistoricalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <HistoricalProvider>
      <div className="h-full flex flex-col">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <div className="flex-1 flex overflow-hidden">
          <ResponsiveDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <HistoricalSidebar />
          </ResponsiveDrawer>
          <main className="flex-1 relative overflow-hidden bg-slate-50">
            <Outlet />
          </main>
        </div>
      </div>
    </HistoricalProvider>
  );
}
