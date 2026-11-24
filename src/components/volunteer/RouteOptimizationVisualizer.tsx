import React, { useEffect, useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import {
  optimizeVolunteerRoute,
  OptimizedRouteStop,
} from '../../services/forecastingService';
import { GeoPoint, SurplusDonation, UserAccount } from '../../types/platform';
import { MapMarkerItem, MapRouteLine, RouteMap } from '../shared/RouteMap';

interface RouteOptimizationVisualizerProps {
  volunteer: UserAccount | null;
  assignedTasks: SurplusDonation[];
  openQueueTasks: SurplusDonation[];
  focusedTaskId: string | null;
  onFocusTask: (taskId: string) => void;
  onInspectNgo: (ngoId?: string) => void;
}

export const RouteOptimizationVisualizer: React.FC<RouteOptimizationVisualizerProps> = ({
  volunteer,
  assignedTasks,
  openQueueTasks,
  focusedTaskId,
  onFocusTask,
  onInspectNgo,
}) => {
  const { users } = usePlatform();

  const [routeMode, setRouteMode] = useState<'assigned' | 'combined' | 'single'>('assigned');
  const [showBaselineComparison, setShowBaselineComparison] = useState<boolean>(true);
  const [selectedStopOrder, setSelectedStopOrder] = useState<number | null>(null);
  const [excludedTaskIds, setExcludedTaskIds] = useState<string[]>([]);

  // Reset exclusions when mode or tasks list changes significantly
  useEffect(() => {
    setSelectedStopOrder(null);
  }, [routeMode, focusedTaskId]);

  const startLocation: GeoPoint = useMemo(() => {
    if (volunteer?.location) return volunteer.location;
    const fallbackVol = users.find((u) => u.role === 'volunteer');
    return (
      fallbackVol?.location ?? {
        lat: 12.9716,
        lng: 77.6387,
        address: 'Indiranagar Dispatch Hub',
        neighborhood: 'Indiranagar',
      }
    );
  }, [volunteer, users]);

  const candidateTasks = useMemo(() => {
    if (routeMode === 'single') {
      const pool = [...assignedTasks, ...openQueueTasks];
      const match =
        (focusedTaskId && pool.find((d) => d.id === focusedTaskId)) || pool[0];
      return match ? [match] : [];
    }
    if (routeMode === 'combined') {
      return [...assignedTasks, ...openQueueTasks];
    }
    return assignedTasks;
  }, [routeMode, assignedTasks, openQueueTasks, focusedTaskId]);

  const activeTasks = useMemo(
    () => candidateTasks.filter((t) => !excludedTaskIds.includes(t.id)),
    [candidateTasks, excludedTaskIds]
  );

  const optimization = useMemo(
    () => optimizeVolunteerRoute(startLocation, activeTasks),
    [startLocation, activeTasks]
  );

  const toggleTaskIncluded = (taskId: string) => {
    setExcludedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  // Build Leaflet markers & multi-stop chained polylines
  const { markers, routes, focusedMarkerId } = useMemo(() => {
    const markerList: MapMarkerItem[] = [
      {
        id: 'vol-start',
        label: volunteer?.name ?? 'Volunteer Courier',
        sublabel: `Start · ${volunteer?.vehicleType ?? 'Cold-Chain Courier'}`,
        badgeText: 'V',
        type: 'volunteer',
        point: startLocation,
      },
    ];

    const routeLines: MapRouteLine[] = [];

    // Baseline sequential comparison path (dashed slate) when toggled on and >= 2 tasks
    if (
      showBaselineComparison &&
      optimization.baselineStops.length > 0 &&
      activeTasks.length > 1
    ) {
      let basePrev = startLocation;
      optimization.baselineStops.forEach((stop, idx) => {
        routeLines.push({
          id: `baseline-leg-${idx}`,
          from: basePrev,
          to: stop.point,
          label: `Sequential Order Leg ${idx + 1} (${stop.legDistanceKm} km)`,
          active: false,
          dashed: true,
          color: '#64748b',
        });
        basePrev = stop.point;
      });
    }

    // Track coordinate duplicates so stacked markers at the same venue remain distinct on Leaflet
    const coordSeen = new Map<string, number>();

    let optPrev = startLocation;
    let resolvedFocusMarker: string | null = null;

    optimization.stops.forEach((stop) => {
      const legId = `opt-leg-${stop.order}`;
      routeLines.push({
        id: legId,
        from: optPrev,
        to: stop.point,
        label: `Stop ${stop.order} (${stop.kind === 'pickup' ? 'Pickup' : 'Drop-off'}): ${stop.legDistanceKm} km`,
        active: true,
        dashed: false,
        color: '#006b2c',
      });
      optPrev = stop.point;

      const coordKey = `${stop.point.lat.toFixed(4)},${stop.point.lng.toFixed(4)}`;
      const seenCount = coordSeen.get(coordKey) ?? 0;
      coordSeen.set(coordKey, seenCount + 1);

      const offsetLat = seenCount * 0.00035;
      const offsetLng = seenCount * 0.00035;

      const markerId = `stop-${stop.order}-${stop.donation.id}`;
      const isSelected =
        selectedStopOrder === stop.order ||
        (selectedStopOrder === null && focusedTaskId === stop.donation.id && stop.kind === 'pickup');

      if (isSelected) {
        resolvedFocusMarker = markerId;
      }

      markerList.push({
        id: markerId,
        label: `Stop #${stop.order}: ${stop.title}`,
        sublabel: `${stop.kind === 'pickup' ? 'Pickup' : 'Drop-off'} · ${stop.donation.foodTitle} (${stop.legDistanceKm} km leg)`,
        badgeText: `${stop.order}${stop.kind === 'pickup' ? 'P' : 'D'}`,
        type: stop.kind === 'pickup' ? 'donor' : 'ngo',
        point: {
          ...stop.point,
          lat: stop.point.lat + offsetLat,
          lng: stop.point.lng + offsetLng,
        },
        selected: isSelected,
      });
    });

    return {
      markers: markerList,
      routes: routeLines,
      focusedMarkerId: resolvedFocusMarker,
    };
  }, [
    volunteer,
    startLocation,
    optimization,
    showBaselineComparison,
    activeTasks.length,
    selectedStopOrder,
    focusedTaskId,
  ]);

  const renderStopRow = (stop: OptimizedRouteStop) => {
    const isPickup = stop.kind === 'pickup';
    const isHighlighted = selectedStopOrder === stop.order;

    return (
      <div
        key={`${stop.order}-${stop.donation.id}-${stop.kind}`}
        className={`p-3 rounded-xl transition-colors flex items-start justify-between gap-3 ${
          isHighlighted
            ? 'bg-secondary-container/45'
            : 'bg-surface-container-low hover:bg-surface-container'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedStopOrder(stop.order);
            onFocusTask(stop.donation.id);
          }}
          className="flex items-start gap-2.5 text-left min-w-0 flex-1"
        >
          <span
            className={`w-6 h-6 rounded-full text-[10px] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 ${
              isPickup
                ? 'bg-primary text-on-primary'
                : 'bg-on-surface text-white'
            }`}
          >
            {stop.order}
            {isPickup ? 'P' : 'D'}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant">
              <span className="font-bold uppercase text-[10px] text-primary">
                {isPickup ? 'Pickup' : 'Drop-off'}
              </span>
              <span>·</span>
              <span className="font-mono font-semibold text-on-surface">
                +{stop.legDistanceKm} km
              </span>
              <span>·</span>
              <span className="font-mono text-outline">~{stop.cumulativeMinutes} min</span>
            </div>
            <p className="text-xs font-bold text-on-surface truncate mt-0.5">{stop.title}</p>
            <p className="text-[11px] text-on-surface-variant truncate">{stop.subtitle}</p>
            <p className="text-[10px] text-outline truncate">{stop.point.address}</p>
          </div>
        </button>

        {!isPickup && stop.donation.claimedByNgoId && (
          <button
            type="button"
            onClick={() => onInspectNgo(stop.donation.claimedByNgoId)}
            title="View NGO Profile"
            className="px-2 py-1 rounded-lg bg-surface-container-lowest text-primary hover:bg-secondary-container text-[10px] font-bold shadow-sm shrink-0"
          >
            NGO Info
          </button>
        )}
      </div>
    );
  };

  return (
    <section
      aria-label="Multi-Stop Route Optimization Visualizer"
      className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4"
    >
      {/* Visualizer Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold text-on-surface">
            Multi-Stop Route Optimization Visualizer
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Nearest-neighbor pickup-before-dropoff sequencing on OpenStreetMap for{' '}
            <strong className="text-on-surface">{volunteer?.name ?? 'Assigned Fleet'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {candidateTasks.length > 1 && (
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={showBaselineComparison}
                onChange={(e) => setShowBaselineComparison(e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary"
              />
              <span>Compare Sequential Path</span>
            </label>
          )}

          <div className="inline-flex items-center gap-1 p-1 bg-surface-container-low rounded-xl">
            {(
              [
                { id: 'assigned', label: `Assigned (${assignedTasks.length})` },
                {
                  id: 'combined',
                  label: `+ Open Queue (${assignedTasks.length + openQueueTasks.length})`,
                },
                { id: 'single', label: 'Single Task' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setExcludedTaskIds([]);
                  setRouteMode(tab.id);
                }}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
                  routeMode === tab.id
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Optimization Savings Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-surface-container-low">
          <p className="text-[11px] uppercase tracking-wider font-bold text-outline">
            Optimized Route
          </p>
          <p className="text-xl font-display font-bold font-mono tabular-nums text-primary mt-0.5">
            {optimization.optimizedDistanceKm.toFixed(1)} km
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono tabular-nums">
            Baseline: {optimization.baselineDistanceKm.toFixed(1)} km
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low">
          <p className="text-[11px] uppercase tracking-wider font-bold text-outline">
            Distance Saved
          </p>
          <p className="text-xl font-display font-bold font-mono tabular-nums text-on-surface mt-0.5">
            {optimization.distanceSavedKm.toFixed(1)} km
          </p>
          <p className="text-[11px] text-secondary font-semibold font-mono tabular-nums">
            {optimization.savingsPct > 0
              ? `-${optimization.savingsPct}% shorter path`
              : 'Optimal order'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low">
          <p className="text-[11px] uppercase tracking-wider font-bold text-outline">
            Est. Total Duration
          </p>
          <p className="text-xl font-display font-bold font-mono tabular-nums text-on-surface mt-0.5">
            {optimization.optimizedMinutes} min
          </p>
          <p className="text-[11px] text-secondary font-semibold font-mono tabular-nums">
            {optimization.timeSavedMinutes > 0
              ? `${optimization.timeSavedMinutes} min saved`
              : 'Includes 4m/stop handoff'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low">
          <p className="text-[11px] uppercase tracking-wider font-bold text-outline">
            Connected Stops
          </p>
          <p className="text-xl font-display font-bold font-mono tabular-nums text-on-surface mt-0.5">
            {optimization.stops.length} stops
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono tabular-nums">
            {activeTasks.length} food batches · {optimization.co2FuelSavedKg} kg CO₂ saved
          </p>
        </div>
      </div>

      {/* Main Map + Ordered Sequence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 space-y-2.5">
          <RouteMap
            markers={markers}
            routes={routes}
            focusedMarkerId={focusedMarkerId}
            heightClass="h-96"
            onSelectMarker={(id) => {
              const match = id.match(/^stop-(\d+)-(.+)$/);
              if (match) {
                setSelectedStopOrder(Number(match[1]));
                onFocusTask(match[2]);
              }
            }}
          />

          {showBaselineComparison && activeTasks.length > 1 && (
            <div className="px-3 py-2 rounded-xl bg-surface-container-low flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-5 h-1 rounded-full bg-primary inline-block" />
                  Optimized Multi-Stop Route
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-5 border-t-2 border-dashed border-slate-500 inline-block" />
                  Unoptimized Sequential Path
                </span>
              </div>
              <span className="font-mono font-semibold text-primary">
                Click any numbered pin (1P, 2D...) to inspect
              </span>
            </div>
          )}
        </div>

        {/* Ordered Stop Sequence & Task Filter */}
        <div className="lg:col-span-5 space-y-3">
          {candidateTasks.length > 1 && (
            <div className="p-3 rounded-xl bg-surface-container-low space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
                Include Batches in Route Plan
              </p>
              <div className="flex flex-wrap gap-1.5">
                {candidateTasks.map((t) => {
                  const included = !excludedTaskIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTaskIncluded(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 ${
                        included
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container-lowest text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {included ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="font-mono">#{t.id.toUpperCase()}</span>
                      <span className="truncate max-w-[110px]">{t.pickupLocation.neighborhood}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
            {/* Start Node */}
            <div className="px-3 py-2.5 rounded-xl bg-tertiary-fixed/40 flex items-center gap-2.5 text-xs">
              <span className="w-6 h-6 rounded-full bg-tertiary-container text-on-tertiary text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                V
              </span>
              <div className="min-w-0">
                <p className="font-bold text-on-surface truncate">
                  Start: {volunteer?.name ?? 'Courier Hub'} ({startLocation.neighborhood})
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {startLocation.address}
                </p>
              </div>
            </div>

            {optimization.stops.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                Select at least one batch above or switch to &ldquo;+ Open Queue&rdquo; to visualize a multi-stop optimized route.
              </div>
            ) : (
              optimization.stops.map(renderStopRow)
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
