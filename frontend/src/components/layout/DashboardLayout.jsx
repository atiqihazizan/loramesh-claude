// src/components/layout/DashboardLayout.jsx
// Layout DASHBOARD — sidebar kiri tetap + kawasan kandungan kanan.
// Untuk halaman borang/jadual: Tetapan, Admin.
//
// Ini AppLayout E1 dinamakan semula. Isi kekal sama — cuma nama
// jelaskan peranannya (satu daripada dua jenis layout sistem).

import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import Sidebar from './Sidebar.jsx';

export default function DashboardLayout() {
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}