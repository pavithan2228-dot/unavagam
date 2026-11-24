import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import {
  calculateDistanceKm,
  computeDemandForecast,
} from '../../services/forecastingService';
import { InventoryItem, UserAccount } from '../../types/platform';
import {
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
} from '../../utils/formatters';
import { NavSectionId } from '../layout/DashboardLayout';
import { NgoProfileModal } from '../shared/NgoProfileModal';
import { MapMarkerItem, MapRouteLine, RouteMap } from '../shared/RouteMap';
import { WorkflowStepper } from '../shared/WorkflowStepper';
import { SurplusConfirmModal } from './SurplusConfirmModal';

interface DonorDashboardProps {
  mode: 'overview' | 'donations';
  onNavigate: (section: NavSectionId, itemId?: string) => void;
}

export const DonorDashboard: React.FC<DonorDashboardProps> = ({ mode, onNavigate }) => {
  const { currentUser, users, inventory, donations } = usePlatform();
  const [confirmTarget, setConfirmTarget] = useState<{
    item: InventoryItem | null;
    aiKg?: number;
  } | null>(null);
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);

  const openNgoById = (ngoId?: string) => {
    if (!ngoId) return;
    const found = users.find((u) => u.id === ngoId && u.role === 'ngo');
    if (found) setSelectedNgo(found);
  };

  const donorInventory = useMemo(() => {
    if (!currentUser || currentUser.role !== 'donor') return inventory;
    const own = inventory.filter((i) => i.donorId === currentUser.id);
    return own.length > 0 ? own : inventory;
  }, [inventory, currentUser]);

  const donorDonations = useMemo(() => {
    if (!currentUser || currentUser.role !== 'donor') return donations;
    const own = donations.filter((d) => d.donorId === currentUser.id);
    return own.length > 0 ? own : donations;
  }, [donations, currentUser]);

  const surplusAlerts = useMemo(() => {
    return donorInventory
      .filter((item) => new Date(item.expiryTime).getTime() > Date.now())
      .map((item) => {
        const forecast = computeDemandForecast(item, {
          expectedAttendancePct: 86,
          dayType: 'Weekday',
          weatherCondition: 'Clear',
        });
        return { item, forecast };
      })
      .filter((entry) => entry.forecast.detectedSurplusKg >= 2);
  }, [donorInventory]);

  const totalSavedKg = donorDonations
    .filter((d) => d.status === 'delivered')
    .reduce((acc, d) => acc + d.confirmedQuantityKg, 0);

  const totalMealsServed = donorDonations
    .filter((d) => d.status === 'delivered')
    .reduce((acc, d) => acc + d.estimatedServings, 0);

  const activeDonations = donorDonations.filter((d) => d.status !== 'delivered');
  const latestActive = activeDonations[0] ?? donorDonations[0];

  const donorLocation = useMemo(
    () =>
      currentUser?.role === 'donor'
        ? currentUser.location
        : users.find((u) => u.role === 'donor')?.location ?? users[0].location,
    [currentUser, users]
  );

  const nearbyNgos = useMemo(
    () =>
      users
        .filter((u) => u.role === 'ngo' && u.verificationStatus === 'verified')
        .map((ngo) => ({
          ngo,
          distanceKm: calculateDistanceKm(donorLocation, ngo.location),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [users, donorLocation]
  );

  const donorNetworkMap = useMemo(() => {
    const markers: MapMarkerItem[] = [
      {
        id: 'self-donor',
        label: currentUser?.organization ?? 'Donor Kitchen',
        sublabel: `Pickup Origin · ${donorLocation.neighborhood}`,
        badgeText: 'P',
        type: 'donor',
        point: donorLocation,
        selected: true,
      },
    ];
    const routes: MapRouteLine[] = [];

    nearbyNgos.forEach(({ ngo, distanceKm }) => {
      markers.push({
        id: ngo.id,
        label: ngo.organization,
        sublabel: `Verified NGO · ${distanceKm} km · Cap ${ngo.capacityKg ?? 100} kg`,
        badgeText: 'D',
        type: 'ngo',
        point: ngo.location,
      });
    });

    activeDonations.forEach((don) => {
      if (don.dropoffLocation) {
        routes.push({
          id: `donor-route-${don.id}`,
          from: don.pickupLocation,
          to: don.dropoffLocation,
          label: `${don.foodTitle} → ${don.claimedByNgoName ?? 'NGO'} (${don.confirmedQuantityKg} kg)`,
          active: don.status === 'in_transit' || don.status === 'picked_up',
          dashed: don.status === 'ngo_requested',
        });
      }
      if (don.assignedVolunteerId) {
        const shipper = users.find((u) => u.id === don.assignedVolunteerId);
        if (shipper) {
          markers.push({
            id: `shipper-${don.id}`,
            label: shipper.name,
            sublabel: `${shipper.vehicleType ?? 'Shipper'} · ${getStatusLabel(don.status)}`,
            badgeText: 'S',
            type: 'volunteer',
            point: shipper.location,
          });
        }
      }
    });

    return { markers, routes };
  }, [currentUser, donorLocation, nearbyNgos, activeDonations, users]);

  if (mode === 'donations') {
    return (
      <div className="space-y-5">
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-display font-bold text-on-surface">
              Published Surplus Donations
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Track NGO claims, assigned volunteers, and verified temperature handoffs in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmTarget({ item: null })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Publish Custom Surplus</span>
          </button>
        </div>

        <div className="space-y-4">
          {donorDonations.map((don) => (
            <div
              key={don.id}
              className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span className="font-mono font-bold text-primary">
                      #{don.id.toUpperCase()}
                    </span>
                    <span>·</span>
                    <span>{don.category}</span>
                    <span>·</span>
                    <span>
                      {don.storageCondition} ({don.temperatureC}°C)
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface mt-1">{don.foodTitle}</h3>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[11px] text-outline font-semibold">Quantity</p>
                    <p className="text-sm font-mono font-bold text-on-surface">
                      {don.confirmedQuantityKg} kg ({don.estimatedServings} meals)
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold ${getStatusBadgeClass(
                      don.status
                    )}`}
                  >
                    {getStatusLabel(don.status)}
                  </span>
                </div>
              </div>

              <WorkflowStepper status={don.status} />

              <div className="p-3 rounded-xl bg-surface-container-low flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
                <div className="flex flex-wrap items-center gap-4">
                  <span>
                    NGO:{' '}
                    {don.claimedByNgoName && don.claimedByNgoId ? (
                      <button
                        type="button"
                        onClick={() => openNgoById(don.claimedByNgoId)}
                        className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>{don.claimedByNgoName}</span>
                        <span className="material-symbols-outlined text-[13px]">info</span>
                      </button>
                    ) : (
                      <strong className="text-on-surface">
                        {don.claimedByNgoName ?? 'Awaiting NGO match'}
                      </strong>
                    )}
                  </span>
                  <span>
                    Volunteer:{' '}
                    <strong className="text-on-surface">
                      {don.assignedVolunteerName ?? 'Pending dispatch'}
                    </strong>
                  </span>
                  <span>
                    Allergens:{' '}
                    <strong className="text-on-surface">{don.allergens.join(', ')}</strong>
                  </span>
                </div>
                <span className="font-mono font-semibold text-primary">
                  Deadline {formatRelativeTime(don.collectionDeadline)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {confirmTarget && (
          <SurplusConfirmModal
            open={Boolean(confirmTarget)}
            onClose={() => setConfirmTarget(null)}
            sourceItem={confirmTarget.item}
            aiSuggestedSurplusKg={confirmTarget.aiKg}
          />
        )}

        <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {currentUser?.verificationStatus === 'pending' && (
        <div className="bg-tertiary-fixed rounded-2xl p-4 flex items-start gap-3 text-xs text-on-tertiary-fixed">
          <span className="material-symbols-outlined text-[20px] shrink-0">warning</span>
          <div>
            <p className="font-bold">Account Pending Admin Verification</p>
            <p className="mt-0.5">
              You can log inventory and run demand forecasts. Admin approval activates live NGO broadcasts.
            </p>
          </div>
        </div>
      )}

      {/* 2x2 / 4-col Bento KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
              Surplus Saved
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">eco</span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {totalSavedKg.toFixed(1)}{' '}
            <span className="text-xs font-semibold text-secondary">kg</span>
          </p>
          <p className="text-[11px] text-secondary font-semibold mt-1">
            Verified delivered batches
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
              Meals Provided
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">restaurant</span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {totalMealsServed}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">Across verified local NGOs</p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
              AI Surplus Alerts
            </span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">
              psychology
            </span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {surplusAlerts.length}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">Batches awaiting confirmation</p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
              Active Runs
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">
              verified_user
            </span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {activeDonations.length}
          </p>
          <p className="text-[11px] text-secondary font-semibold mt-1">100% safety gate passed</p>
        </div>
      </div>

      {latestActive && (
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-primary">
                Active Redistribution Progress
              </span>
              <h2 className="text-base font-display font-bold text-on-surface mt-0.5">
                {latestActive.foodTitle} · {latestActive.confirmedQuantityKg} kg
              </h2>
              {latestActive.claimedByNgoName && latestActive.claimedByNgoId && (
                <p className="text-xs text-on-surface-variant mt-1">
                  Matched NGO:{' '}
                  <button
                    type="button"
                    onClick={() => openNgoById(latestActive.claimedByNgoId)}
                    className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>{latestActive.claimedByNgoName}</span>
                    <span className="material-symbols-outlined text-[13px]">info</span>
                  </button>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('donations')}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline whitespace-nowrap"
            >
              <span>View all donations</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          <WorkflowStepper status={latestActive.status} />
        </div>
      )}

      {/* Donor Kitchen Pickup & Nearby Verified NGOs Map */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-display font-bold text-on-surface">
              Kitchen Pickup &amp; Nearby NGO Network Map
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Inspect verified NGO drop-off hubs near {donorLocation.neighborhood} and active shipper routes.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {nearbyNgos.slice(0, 3).map(({ ngo, distanceKm }) => (
              <button
                key={ngo.id}
                type="button"
                onClick={() => setSelectedNgo(ngo)}
                className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-secondary-container text-[11px] font-semibold text-on-surface transition-colors"
              >
                {ngo.organization} ({distanceKm} km)
              </button>
            ))}
          </div>
        </div>
        <RouteMap
          markers={donorNetworkMap.markers}
          routes={donorNetworkMap.routes}
          heightClass="h-72"
          onSelectMarker={(id) => openNgoById(id)}
        />
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 bg-surface-container-low/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-display font-bold text-on-surface">
              AI Surplus Detection Queue
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Confirm actual weight and safety parameters before notifying NGOs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('forecasting')}
            className="text-xs font-bold text-primary hover:underline whitespace-nowrap"
          >
            Open Forecast Simulator →
          </button>
        </div>

        <div className="divide-y divide-surface-container">
          {surplusAlerts.map(({ item, forecast }) => (
            <div
              key={item.id}
              className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-container-low/40 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span>{item.category}</span>
                  <span>·</span>
                  <span>
                    {item.storageCondition} ({item.temperatureC}°C)
                  </span>
                  <span>·</span>
                  <span>Expires {formatRelativeTime(item.expiryTime)}</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{item.itemName}</p>
                <p className="text-xs text-on-surface-variant">{forecast.rationale}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-secondary-container/60 text-on-secondary-container text-right">
                  <p className="text-[10px] font-bold uppercase">AI Est. Surplus</p>
                  <p className="text-sm font-mono font-bold text-primary">
                    {forecast.detectedSurplusKg.toFixed(1)} kg
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('forecasting', item.id)}
                  className="px-3.5 py-2 text-xs font-bold text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-xl transition-colors whitespace-nowrap"
                >
                  Inspect Forecast
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmTarget({
                      item,
                      aiKg: forecast.detectedSurplusKg,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Confirm &amp; Publish</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmTarget && (
        <SurplusConfirmModal
          open={Boolean(confirmTarget)}
          onClose={() => setConfirmTarget(null)}
          sourceItem={confirmTarget.item}
          aiSuggestedSurplusKg={confirmTarget.aiKg}
        />
      )}

      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </div>
  );
};
