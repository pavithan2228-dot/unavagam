import React, { useMemo } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { UserAccount } from '../../types/platform';
import {
  formatDateTimeShort,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
} from '../../utils/formatters';

interface NgoProfileModalProps {
  ngo: UserAccount | null;
  onClose: () => void;
}

export const NgoProfileModal: React.FC<NgoProfileModalProps> = ({ ngo, onClose }) => {
  const { donations, currentUser, updateUserVerification } = usePlatform();

  const ngoHistory = useMemo(() => {
    if (!ngo) return [];
    return donations
      .filter((d) => d.claimedByNgoId === ngo.id)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [donations, ngo]);

  if (!ngo) return null;

  const deliveredRescues = ngoHistory.filter((d) => d.status === 'delivered');
  const activeRescues = ngoHistory.filter(
    (d) => d.status !== 'delivered' && d.status !== 'cancelled'
  );
  const totalRescuedKg = ngoHistory.reduce((acc, d) => acc + d.confirmedQuantityKg, 0);
  const totalMeals = deliveredRescues.reduce((acc, d) => acc + d.estimatedServings, 0);

  const verificationBadge =
    ngo.verificationStatus === 'verified'
      ? {
          cls: 'bg-secondary-container text-on-secondary-container',
          icon: 'verified',
          label: 'Verified NGO',
        }
      : ngo.verificationStatus === 'pending'
        ? {
            cls: 'bg-tertiary-fixed text-on-tertiary-fixed',
            icon: 'schedule',
            label: 'Pending Review',
          }
        : {
            cls: 'bg-error-container text-on-error-container',
            icon: 'gpp_bad',
            label: 'Suspended',
          };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_12px_40px_rgba(11,28,48,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="sticky top-0 bg-surface-container-lowest px-6 py-4 flex items-start justify-between gap-4 z-10 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={ngo.avatarUrl}
              alt={ngo.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-display font-bold text-on-surface truncate">
                  {ngo.organization}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${verificationBadge.cls}`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {verificationBadge.icon}
                  </span>
                  <span>{verificationBadge.label}</span>
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                {ngo.location.address}, {ngo.location.neighborhood}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close NGO profile"
            className="w-9 h-9 flex items-center justify-center rounded-full text-outline hover:text-on-surface hover:bg-surface-container shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Contact & Operational Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Primary Contact
              </p>
              <p className="text-sm font-bold text-on-surface">{ngo.name}</p>
              <div className="space-y-1 text-on-surface-variant">
                <a
                  href={`mailto:${ngo.email}`}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">
                    mail
                  </span>
                  <span className="truncate">{ngo.email}</span>
                </a>
                <a
                  href={`tel:${ngo.phone}`}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors font-mono"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">
                    call
                  </span>
                  <span>{ngo.phone}</span>
                </a>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Facility &amp; Capacity
              </p>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Daily Capacity</span>
                <span className="font-mono font-bold text-primary">
                  {ngo.capacityKg ?? 100} kg / day
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Joined Network</span>
                <span className="font-mono font-semibold text-on-surface">
                  {formatRelativeTime(ngo.joinedAt)}
                </span>
              </div>
              {ngo.dietaryFocus && ngo.dietaryFocus.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1.5">
                  {ngo.dietaryFocus.map((focus) => (
                    <span
                      key={focus}
                      className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-[10px] font-bold shadow-sm"
                    >
                      {focus}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Rescue Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-container-low text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Total Rescued
              </p>
              <p className="text-xl font-display font-bold font-mono text-primary mt-1">
                {totalRescuedKg.toFixed(1)} kg
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-low text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Meals Served
              </p>
              <p className="text-xl font-display font-bold font-mono text-on-surface mt-1">
                {totalMeals}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-low text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Active Pickups
              </p>
              <p className="text-xl font-display font-bold font-mono text-on-surface mt-1">
                {activeRescues.length}
              </p>
            </div>
          </div>

          {/* Recent Food Rescue History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-on-surface">
                Recent Food Rescue History
              </h3>
              <span className="text-xs font-mono text-outline">
                {ngoHistory.length} records
              </span>
            </div>

            {ngoHistory.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                No food rescue deliveries recorded for {ngo.organization} yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {ngoHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                        <span className="font-mono font-bold text-primary">
                          #{item.id.toUpperCase()}
                        </span>
                        <span>·</span>
                        <span>From {item.donorOrg}</span>
                        <span>·</span>
                        <span>{formatDateTimeShort(item.createdAt)}</span>
                      </div>
                      <p className="text-xs font-bold text-on-surface truncate">
                        {item.foodTitle}
                      </p>
                      {item.deliveryNote && (
                        <p className="text-[11px] text-on-surface-variant">
                          {item.deliveryNote}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold text-on-surface">
                          {item.confirmedQuantityKg} kg
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {item.estimatedServings} meals
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${getStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            {currentUser?.role === 'admin' && ngo.verificationStatus === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    updateUserVerification(ngo.id, 'suspended');
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-bold text-on-error-container bg-error-container hover:opacity-90 rounded-xl"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateUserVerification(ngo.id, 'verified');
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Verify NGO</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
