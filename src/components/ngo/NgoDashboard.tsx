import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import {
  calculateDistanceKm,
  estimateTransitMinutes,
} from '../../services/forecastingService';
import { SurplusDonation, UserAccount } from '../../types/platform';
import {
  formatDateTimeShort,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
} from '../../utils/formatters';
import { NgoProfileModal } from '../shared/NgoProfileModal';
import { MapMarkerItem, MapRouteLine, RouteMap } from '../shared/RouteMap';
import { WorkflowStepper } from '../shared/WorkflowStepper';

interface NgoDashboardProps {
  mode: 'overview' | 'discover' | 'collections';
}

export const NgoDashboard: React.FC<NgoDashboardProps> = ({ mode }) => {
  const { currentUser, users, donations, claimDonationAsNgo } = usePlatform();
  const [selectedDonation, setSelectedDonation] = useState<SurplusDonation | null>(null);
  const [focusedDonationId, setFocusedDonationId] = useState<string | null>(null);
  const [dietFilter, setDietFilter] = useState<string>('All');
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);

  const activeNgoUser = useMemo(
    () =>
      currentUser?.role === 'ngo'
        ? currentUser
        : users.find((u) => u.role === 'ngo') ?? null,
    [currentUser, users]
  );

  const openNgoById = (ngoId?: string) => {
    const found = ngoId
      ? users.find((u) => u.id === ngoId && u.role === 'ngo')
      : activeNgoUser;
    if (found) setSelectedNgo(found);
  };

  const ngoLocation =
    currentUser?.role === 'ngo'
      ? currentUser.location
      : users.find((u) => u.role === 'ngo')?.location ?? users[0].location;

  const availableDonations = useMemo(() => {
    return donations
      .filter((d) => d.status === 'published')
      .filter((d) => (dietFilter === 'All' ? true : d.dietaryType === dietFilter))
      .map((d) => {
        const distanceKm = calculateDistanceKm(d.pickupLocation, ngoLocation);
        const eta = estimateTransitMinutes(distanceKm);
        return { donation: d, distanceKm, eta };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [donations, ngoLocation, dietFilter]);

  const myCollections = useMemo(() => {
    const ngoId = currentUser?.role === 'ngo' ? currentUser.id : 'ngo-1';
    return donations.filter((d) => d.claimedByNgoId === ngoId);
  }, [donations, currentUser]);

  const activeCollections = myCollections.filter((d) => d.status !== 'delivered');
  const deliveredMeals = myCollections
    .filter((d) => d.status === 'delivered')
    .reduce((acc, d) => acc + d.estimatedServings, 0);
  const deliveredKg = myCollections
    .filter((d) => d.status === 'delivered')
    .reduce((acc, d) => acc + d.confirmedQuantityKg, 0);

  // Discovery Map: NGO Drop-off hub + all Donor Pickup points + preview route lines
  const { discoveryMarkers, discoveryRoutes } = useMemo(() => {
    const markers: MapMarkerItem[] = [
      {
        id: 'self-ngo',
        label: currentUser?.organization ?? 'Hope Hearth Foundation',
        sublabel: 'NGO Drop-off Hub',
        badgeText: 'D',
        type: 'ngo',
        point: ngoLocation,
        selected: true,
      },
    ];
    const routes: MapRouteLine[] = [];

    availableDonations.forEach(({ donation, distanceKm, eta }) => {
      const isFocused = focusedDonationId === donation.id;
      markers.push({
        id: donation.id,
        label: donation.donorOrg,
        sublabel: `${donation.foodTitle} (${donation.confirmedQuantityKg} kg · ${distanceKm} km)`,
        badgeText: 'P',
        type: 'donor',
        point: donation.pickupLocation,
        selected: isFocused,
      });

      routes.push({
        id: `preview-${donation.id}`,
        from: donation.pickupLocation,
        to: ngoLocation,
        label: `${donation.donorOrg} → Drop-off (${distanceKm} km · ~${eta}m)`,
        active: isFocused,
        dashed: !isFocused,
      });
    });

    return { discoveryMarkers: markers, discoveryRoutes: routes };
  }, [availableDonations, currentUser, ngoLocation, focusedDonationId]);

  // Active Collections Map: Pickup -> Dropoff corridors for claimed batches
  const { collectionsMarkers, collectionsRoutes } = useMemo(() => {
    const markers: MapMarkerItem[] = [
      {
        id: 'ngo-hub-active',
        label: currentUser?.organization ?? 'Hope Hearth Foundation',
        sublabel: 'Drop-off Destination',
        badgeText: 'D',
        type: 'ngo',
        point: ngoLocation,
        selected: true,
      },
    ];
    const routes: MapRouteLine[] = [];

    activeCollections.forEach((don) => {
      markers.push({
        id: `active-${don.id}`,
        label: don.donorOrg,
        sublabel: `${don.foodTitle} · ${getStatusLabel(don.status)}`,
        badgeText: 'P',
        type: 'donor',
        point: don.pickupLocation,
        selected: don.status === 'in_transit' || don.status === 'picked_up',
      });

      const dropPoint = don.dropoffLocation ?? ngoLocation;
      routes.push({
        id: `active-route-${don.id}`,
        from: don.pickupLocation,
        to: dropPoint,
        label: `${don.donorOrg} → ${don.claimedByNgoName ?? 'NGO'} (${don.distanceKm ?? 3.2} km)`,
        active: true,
        dashed: don.status === 'ngo_requested',
      });

      if (don.assignedVolunteerId) {
        const volUser = users.find((u) => u.id === don.assignedVolunteerId);
        if (volUser) {
          markers.push({
            id: `vol-${don.id}`,
            label: volUser.name,
            sublabel: `${volUser.vehicleType ?? 'Courier'} · ${getStatusLabel(don.status)}`,
            badgeText: 'V',
            type: 'volunteer',
            point: volUser.location,
          });
        }
      }
    });

    return { collectionsMarkers: markers, collectionsRoutes: routes };
  }, [activeCollections, currentUser, ngoLocation, users]);

  const renderDonationSafetyModal = () => {
    if (!selectedDonation) return null;
    const distanceKm = calculateDistanceKm(selectedDonation.pickupLocation, ngoLocation);
    const eta = estimateTransitMinutes(distanceKm);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/45 backdrop-blur-sm">
        <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Safety &amp; Hygiene Inspection
              </span>
              <h3 className="text-lg font-display font-bold text-on-surface mt-0.5">
                {selectedDonation.foodTitle}
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {selectedDonation.donorOrg} · {selectedDonation.pickupLocation.address}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDonation(null)}
              className="w-9 h-9 flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container rounded-full"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-surface-container-low rounded-xl">
              <p className="text-outline font-bold uppercase text-[10px]">Confirmed Weight</p>
              <p className="font-mono font-bold text-on-surface text-sm mt-0.5">
                {selectedDonation.confirmedQuantityKg} kg ({selectedDonation.estimatedServings}{' '}
                meals)
              </p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl">
              <p className="text-outline font-bold uppercase text-[10px]">Pickup → Drop-off</p>
              <p className="font-mono font-bold text-on-surface text-sm mt-0.5">
                {distanceKm} km (~{eta} min)
              </p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl">
              <p className="text-outline font-bold uppercase text-[10px]">Storage Condition</p>
              <p className="font-bold text-primary mt-0.5">
                {selectedDonation.storageCondition} · {selectedDonation.temperatureC}°C
              </p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl">
              <p className="text-outline font-bold uppercase text-[10px]">Allergens Declared</p>
              <p className="font-bold text-on-surface mt-0.5">
                {selectedDonation.allergens.join(', ')}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-on-surface-variant p-3.5 rounded-xl bg-surface-container-low">
            <div className="flex justify-between">
              <span>Prepared Timestamp</span>
              <span className="font-mono font-semibold text-on-surface">
                {formatDateTimeShort(selectedDonation.preparedAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Collection Deadline</span>
              <span className="font-mono text-tertiary font-bold">
                {formatDateTimeShort(selectedDonation.collectionDeadline)} (
                {formatRelativeTime(selectedDonation.collectionDeadline)})
              </span>
            </div>
            <div className="pt-1">
              <span className="text-outline font-semibold block mb-0.5">Donor Hygiene Notes</span>
              <p className="text-on-surface">{selectedDonation.safetyNotes}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedDonation(null)}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                claimDonationAsNgo(selectedDonation.id);
                setSelectedDonation(null);
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Request &amp; Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {currentUser?.verificationStatus === 'pending' && (
        <div className="bg-tertiary-fixed rounded-2xl p-4 flex items-start gap-3 text-xs text-on-tertiary-fixed">
          <span className="material-symbols-outlined text-[20px] shrink-0">warning</span>
          <div>
            <p className="font-bold">NGO Verification Pending</p>
            <p className="mt-0.5">
              You can browse available donations, but Admin verification is required before claiming batches.
            </p>
          </div>
        </div>
      )}

      {mode === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Available Nearby
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">radar</span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {availableDonations.length}
            </p>
            <p className="text-[11px] text-secondary font-semibold mt-1">
              Safety-verified listings
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Active Collections
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">
                local_shipping
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {activeCollections.length}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">In dispatch or transit</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Food Received
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">
                inventory_2
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {deliveredKg.toFixed(1)}{' '}
              <span className="text-xs font-semibold text-secondary">kg</span>
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">Verified kitchen deliveries</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Meals Served
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">
                volunteer_activism
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {deliveredMeals}
            </p>
            <p className="text-[11px] text-secondary font-semibold mt-1">
              Capacity {currentUser?.capacityKg ?? 120} kg/day
            </p>
          </div>
        </div>
      )}

      {(mode === 'overview' || mode === 'discover') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 bg-surface-container-low/60 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-display font-bold text-on-surface">
                  Nearby Verified Surplus Food
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Sorted by distance to your drop-off hub in{' '}
                  {currentUser?.location.neighborhood ?? 'Domlur'}.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl">
                {['All', 'Vegetarian', 'Vegan'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDietFilter(f)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      dietFilter === f
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {availableDonations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold text-on-surface">
                  No unclaimed food donations right now.
                </p>
                <p className="text-xs text-on-surface-variant">
                  Switch to the Donor role to confirm and publish a surplus batch, and it will appear on the map immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-surface-container">
                {availableDonations.map(({ donation, distanceKm, eta }) => (
                  <div
                    key={donation.id}
                    className={`p-5 space-y-3 transition-colors ${
                      focusedDonationId === donation.id
                        ? 'bg-secondary-container/20'
                        : 'hover:bg-surface-container-low/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span className="font-bold text-primary">{donation.donorOrg}</span>
                          <span>·</span>
                          <span>{donation.dietaryType}</span>
                          <span>·</span>
                          <span className="font-mono font-semibold">{distanceKm} km away</span>
                        </div>
                        <h3 className="text-sm font-bold text-on-surface mt-1">
                          {donation.foodTitle}
                        </h3>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-secondary-container text-on-secondary-container text-right shrink-0">
                        <p className="text-sm font-mono font-bold">
                          {donation.confirmedQuantityKg} kg
                        </p>
                        <p className="text-[10px] font-bold">
                          ~{donation.estimatedServings} meals
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-primary">
                          thermostat
                        </span>
                        {donation.storageCondition} ({donation.temperatureC}°C)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-tertiary">
                          schedule
                        </span>
                        Collect {formatRelativeTime(donation.collectionDeadline)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-outline">
                          near_me
                        </span>
                        ~{eta} min transit
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-outline">
                        Pickup: <strong className="text-on-surface">{donation.pickupLocation.neighborhood}</strong>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFocusedDonationId(donation.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary bg-surface-container-low hover:bg-surface-container rounded-xl transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">map</span>
                          <span>Show Route</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDonation(donation)}
                          className="px-3 py-1.5 text-xs font-bold text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-xl transition-colors"
                        >
                          Safety Log
                        </button>
                        <button
                          type="button"
                          onClick={() => claimDonationAsNgo(donation.id)}
                          className="px-4 py-1.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
                        >
                          Request &amp; Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-display font-bold text-on-surface">
                  Pickup &amp; Drop-off Map
                </h3>
                <p className="text-[11px] text-on-surface-variant">
                  Click any pin or &ldquo;Show Route&rdquo; to inspect pickup path
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                {availableDonations.length} Nearby
              </span>
            </div>
            <RouteMap
              markers={discoveryMarkers}
              routes={discoveryRoutes}
              focusedMarkerId={focusedDonationId}
              heightClass="h-84"
              onSelectMarker={(id) => {
                if (id === 'self-ngo') {
                  openNgoById();
                } else {
                  setFocusedDonationId(id);
                }
              }}
            />
          </div>
        </div>
      )}

      {(mode === 'overview' || mode === 'collections') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div
            className={`${
              mode === 'collections' && activeCollections.length > 0
                ? 'lg:col-span-7'
                : 'lg:col-span-12'
            } bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden`}
          >
            <div className="px-5 py-4 bg-surface-container-low/60 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-display font-bold text-on-surface">
                  Your Claimed Collections &amp; Delivery Tracking
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Live volunteer pickup and drop-off progress for accepted donations.
                </p>
              </div>
              {activeNgoUser && (
                <button
                  type="button"
                  onClick={() => setSelectedNgo(activeNgoUser)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-surface-container-lowest hover:bg-secondary-container/50 rounded-xl shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">verified</span>
                  <span>NGO Profile &amp; History</span>
                </button>
              )}
            </div>

            {myCollections.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">
                No collections claimed yet. Accept a nearby donation above to trigger volunteer dispatch.
              </div>
            ) : (
              <div className="divide-y divide-surface-container">
                {myCollections.map((don) => (
                  <div key={don.id} className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-on-surface-variant">
                          Pickup: <strong className="text-on-surface">{don.donorOrg}</strong> →
                          Drop-off:{' '}
                          <button
                            type="button"
                            onClick={() => openNgoById(don.claimedByNgoId)}
                            className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>{don.claimedByNgoName ?? 'Your Hub'}</span>
                            <span className="material-symbols-outlined text-[13px]">info</span>
                          </button>{' '}
                          · {don.distanceKm ?? 3.2} km · Volunteer:{' '}
                          <strong className="text-primary">
                            {don.assignedVolunteerName ?? 'Waiting for courier'}
                          </strong>
                        </p>
                        <h3 className="text-sm font-bold text-on-surface mt-1">
                          {don.foodTitle} ({don.confirmedQuantityKg} kg · {don.estimatedServings}{' '}
                          meals)
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold self-start ${getStatusBadgeClass(
                          don.status
                        )}`}
                      >
                        {getStatusLabel(don.status)}
                      </span>
                    </div>
                    <WorkflowStepper status={don.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {mode === 'collections' && activeCollections.length > 0 && (
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-3">
              <div>
                <h3 className="text-sm font-display font-bold text-on-surface">
                  Live Inbound Collection Map
                </h3>
                <p className="text-[11px] text-on-surface-variant">
                  Pickup kitchens, active courier positions, and NGO drop-off hub
                </p>
              </div>
              <RouteMap
                markers={collectionsMarkers}
                routes={collectionsRoutes}
                heightClass="h-80"
                onSelectMarker={(id) => {
                  if (id === 'self-ngo') {
                    openNgoById();
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {renderDonationSafetyModal()}
      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </div>
  );
};
