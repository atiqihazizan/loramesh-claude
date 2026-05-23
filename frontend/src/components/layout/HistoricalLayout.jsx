// E4-a — historical area layout (TopBar + historical sidebar + outlet)
// E4-b — wrapped in HistoricalProvider to share query selection.

import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import HistoricalSidebar from '../../historical/HistoricalSidebar.jsx';
import { HistoricalProvider } from '../../historical/HistoricalContext.jsx';

export default function HistoricalLayout() {
  return (
    <HistoricalProvider>
      <div className="h-full flex flex-col">
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          <HistoricalSidebar />
          <main className="flex-1 relative overflow-hidden bg-slate-50">
            <Outlet />
          </main>
        </div>
      </div>
    </HistoricalProvider>
  );
}
