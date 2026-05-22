// src/hooks/useAgencies.js
// ----------------------------------------------------------------
// Ambil senarai agency untuk pemilih agency superadmin.
//
// GET /api/agencies — dilindungi requireSuperadmin di backend.
// Jadi hook ini HANYA dipanggil untuk pengguna superadmin
// (parameter `enabled`). Pengguna biasa tak panggil endpoint ini —
// mereka terkunci pada user.agency.id sendiri.
//
// Respons: { agencies: [ { id, name, code, status, ... } ] }
// ----------------------------------------------------------------

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

async function fetchAgencies() {
  const res = await api.get('/agencies');
  return res.data?.agencies || [];
}

/**
 * @returns {object} { agencies, isLoading, isError }
 *   agencies — senarai agency (kosong jika bukan superadmin)
 */
export function useAgencies() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  const query = useQuery({
    queryKey: ['agencies'],
    queryFn: fetchAgencies,
    // Hanya superadmin — endpoint requireSuperadmin.
    enabled: isSuperadmin,
    staleTime: 5 * 60 * 1000, // senarai agency jarang berubah
  });

  return {
    agencies: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}