import { DonationStatus, VerificationStatus } from '../types/platform';

export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const absMins = Math.round(Math.abs(diffMs) / 60000);
  if (absMins < 60) {
    return diffMs >= 0 ? `in ${absMins}m` : `${absMins}m ago`;
  }
  const absHours = Math.round(absMins / 60);
  if (absHours < 24) {
    return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
  }
  const absDays = Math.round(absHours / 24);
  return diffMs >= 0 ? `in ${absDays}d` : `${absDays}d ago`;
}

export function formatTimeClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status: DonationStatus): string {
  switch (status) {
    case 'published':
      return 'Published for NGOs';
    case 'ngo_requested':
      return 'NGO Claimed · Needs Volunteer';
    case 'volunteer_assigned':
      return 'Volunteer Assigned';
    case 'picked_up':
      return 'Picked Up';
    case 'in_transit':
      return 'In Transit';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function getStatusToneClass(status: DonationStatus): string {
  switch (status) {
    case 'published':
      return 'text-primary';
    case 'ngo_requested':
      return 'text-tertiary';
    case 'volunteer_assigned':
    case 'picked_up':
    case 'in_transit':
      return 'text-secondary';
    case 'delivered':
      return 'text-primary';
    case 'cancelled':
      return 'text-error';
  }
}

export function getStatusBadgeClass(status: DonationStatus): string {
  switch (status) {
    case 'published':
      return 'bg-secondary-container text-on-secondary-container';
    case 'ngo_requested':
      return 'bg-tertiary-fixed text-on-tertiary-fixed';
    case 'volunteer_assigned':
    case 'picked_up':
    case 'in_transit':
      return 'bg-surface-container-high text-on-surface';
    case 'delivered':
      return 'bg-secondary-container text-on-secondary-container';
    case 'cancelled':
      return 'bg-error-container text-on-error-container';
  }
}

export function getVerificationToneClass(status: VerificationStatus): string {
  switch (status) {
    case 'verified':
      return 'text-primary';
    case 'pending':
      return 'text-tertiary';
    case 'suspended':
      return 'text-error';
  }
}
