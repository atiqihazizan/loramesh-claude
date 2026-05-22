// E3-a — /settings → agency (admin) or account (others)

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

export default function SettingsIndexRedirect() {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  return (
    <Navigate
      to={isAgencyAdmin ? '/settings/agency' : '/settings/account'}
      replace
    />
  );
}
