// E4-a — historical area layout (TopBar + historical sidebar + outlet)

import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import HistoricalSidebar from '../../historical/HistoricalSidebar.jsx';

export default function HistoricalLayout() {
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <HistoricalSidebar />
        <main className="flex-1 relative overflow-hidden bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
