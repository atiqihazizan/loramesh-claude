// NotificationBell — dropdown (desktop) / drawer (mobile)

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications.js';

function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'Baru sahaja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return new Date(iso).toLocaleDateString('ms-MY');
}

function badgeLabel(count) {
  if (count > 9) return '9+';
  return String(count);
}

function NotificationList({ notifications, onItemClick, isLoading }) {
  if (isLoading) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-400">Memuatkan…</p>
    );
  }
  if (!notifications.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500">Tiada notifikasi</p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {notifications.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onItemClick(item)}
            className={
              'w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 ' +
              (!item.is_read ? 'bg-blue-50/80' : '')
            }
          >
            <div className="flex gap-2">
              {!item.is_read && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                  aria-hidden
                />
              )}
              <div className={!item.is_read ? '' : 'pl-4'}>
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                {item.body ? (
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{item.body}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  {formatRelativeTime(item.created_at)}
                </p>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PanelHeader({ unreadCount, onMarkAll, onClose }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-800">Notifikasi</h2>
      <div className="flex items-center gap-2">
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Tanda semua dibaca
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="sm:hidden text-xs text-slate-500 hover:text-slate-700"
          aria-label="Tutup"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleItemClick = async (item) => {
    try {
      await markRead(item.id);
    } catch {
      /* ignore */
    }
    const link = item.link?.trim();
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative z-30" ref={bellRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg
                   text-slate-600 transition-colors hover:bg-slate-100"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center
                       justify-center rounded-full bg-red-500 px-1 text-[10px]
                       font-bold leading-none text-white"
          >
            {badgeLabel(unreadCount)}
          </span>
        ) : null}
      </button>

      {/* Desktop dropdown */}
      {open ? (
        <div
          className="absolute right-0 top-full mt-1.5 hidden w-80 max-h-[min(24rem,70vh)]
                     overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200
                     sm:block"
        >
          <PanelHeader
            unreadCount={unreadCount}
            onMarkAll={handleMarkAll}
            onClose={() => setOpen(false)}
          />
          <div className="max-h-80 overflow-y-auto">
            <NotificationList
              notifications={notifications}
              isLoading={isLoading}
              onItemClick={handleItemClick}
            />
          </div>
        </div>
      ) : null}

      {/* Mobile drawer + overlay */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-y-0 right-0 z-50 flex w-[min(85vw,360px)] flex-col
                       bg-white shadow-2xl sm:hidden"
          >
            <PanelHeader
              unreadCount={unreadCount}
              onMarkAll={handleMarkAll}
              onClose={() => setOpen(false)}
            />
            <div className="flex-1 overflow-y-auto">
              <NotificationList
                notifications={notifications}
                isLoading={isLoading}
                onItemClick={handleItemClick}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
