// User-facing device status labels (English).

const STATUS_LABEL = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
  active: 'Active',
};

export function deviceStatusLabel(status) {
  return STATUS_LABEL[(status || '').toLowerCase()] || 'Offline';
}
