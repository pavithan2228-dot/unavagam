import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { UserAccount } from '../../types/platform';
import { CommunityImpact } from '../shared/CommunityImpact';
import { NgoProfileModal } from '../shared/NgoProfileModal';
import { MapMarkerItem, MapRouteLine, RouteMap } from '../shared/RouteMap';

interface PublicDirectoryViewProps {
  onOpenAuth: () => void;
  onReturnToWorkspace?: () => void;
  isAuthenticated?: boolean;
}

export const PublicDirectoryView: React.FC<PublicDirectoryViewProps> = ({
  onOpenAuth,
  onReturnToWorkspace,
  isAuthenticated = false,
}) => {
  const { donations, users } = usePlatform();
  const [chartTab, setChartTab] = useState<'today' | 'week' | 'category'>('today');
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);
  const [locationFilter, setLocationFilter] = useState<'all' | 'donor' | 'ngo' | 'volunteer'>('all');

  const activeRescuesCount = donations.filter(
    (d) => d.status !== 'delivered' && d.status !== 'cancelled'
  ).length;

  const totalSavedKg = useMemo(
    () =>
      donations
        .filter((d) => d.status !== 'cancelled')
        .reduce((acc, d) => acc + d.confirmedQuantityKg, 0),
    [donations]
  );

  const verifiedNgos = users.filter(
    (u) => u.role === 'ngo' && u.verificationStatus === 'verified'
  );
  const co2TodayKg = Math.round((totalSavedKg + 260) * 2.5);

  const cityMapData = useMemo(() => {
    const markers: MapMarkerItem[] = [];
    const routes: MapRouteLine[] = [];

    users
      .filter((u) => u.role === 'donor' || u.role === 'ngo' || u.role === 'volunteer')
      .filter((u) => (locationFilter === 'all' ? true : u.role === locationFilter))
      .forEach((u) => {
        const markerType: MapMarkerItem['type'] =
          u.role === 'donor' ? 'donor' : u.role === 'ngo' ? 'ngo' : 'volunteer';
        markers.push({
          id: u.id,
          label: u.role === 'volunteer' ? `${u.name} · ${u.organization}` : u.organization,
          sublabel:
            u.role === 'donor'
              ? `Food Donor · ${u.location.neighborhood}`
              : u.role === 'ngo'
                ? `Verified NGO · ${u.capacityKg ?? 100} kg/day`
                : `Shipper · ${u.vehicleType ?? 'Cold-Chain Courier'}`,
          badgeText: u.role === 'donor' ? 'P' : u.role === 'ngo' ? 'D' : 'S',
          type: markerType,
          point: u.location,
        });
      });

    if (locationFilter === 'all' || locationFilter === 'volunteer') {
      donations
        .filter((d) => d.dropoffLocation && d.status !== 'delivered')
        .forEach((d) => {
          if (d.dropoffLocation) {
            routes.push({
              id: `pub-route-${d.id}`,
              from: d.pickupLocation,
              to: d.dropoffLocation,
              label: `${d.foodTitle} (${d.confirmedQuantityKg} kg)`,
              active: d.status === 'in_transit' || d.status === 'picked_up',
              dashed: d.status === 'ngo_requested',
            });
          }
        });
    }

    return { markers, routes };
  }, [users, donations, locationFilter]);

  const chartData = useMemo(() => {
    if (chartTab === 'week') {
      return {
        pill: '2,450 kg Week',
        bars: [
          { label: 'Mon', value: '320', height: '65%', highlight: false, forecast: false },
          { label: 'Tue', value: '290', height: '58%', highlight: false, forecast: false },
          { label: 'Wed', value: '410', height: '82%', highlight: false, forecast: false },
          { label: 'Thu', value: '380', height: '76%', highlight: false, forecast: false },
          { label: 'Fri', value: '510', height: '98%', highlight: true, forecast: false },
          { label: 'Sat', value: '540', height: '92%', highlight: false, forecast: false },
        ],
      };
    }
    if (chartTab === 'category') {
      return {
        pill: 'Categorized',
        bars: [
          { label: 'Cooked', value: '180', height: '90%', highlight: true, forecast: false },
          { label: 'Bakery', value: '120', height: '60%', highlight: false, forecast: false },
          { label: 'Produce', value: '75', height: '42%', highlight: false, forecast: false },
          { label: 'Dairy', value: '35', height: '22%', highlight: false, forecast: false },
          { label: 'Dry', value: '18', height: '14%', highlight: false, forecast: false },
          { label: 'Other', value: '8', height: '10%', highlight: false, forecast: false },
        ],
      };
    }
    return {
      pill: `${Math.round(totalSavedKg + 269)} kg Total`,
      bars: [
        { label: '08:00', value: '42k', height: '35%', highlight: false, forecast: false },
        { label: '11:00', value: '86k', height: '60%', highlight: false, forecast: false },
        { label: '14:00', value: '145k', height: '95%', highlight: true, forecast: false },
        { label: '17:00', value: '68k', height: '48%', highlight: false, forecast: false },
        { label: '20:00', value: '77k', height: '55%', highlight: false, forecast: false },
        { label: '22:00', value: '~50k', height: '40%', highlight: false, forecast: true },
      ],
    };
  }, [chartTab, totalSavedKg]);

  return (
    <div className="flex flex-col w-full space-y-6 pb-8">
      {/* Ambient Hero Section */}
      <section className="relative rounded-2xl p-5 sm:p-7 overflow-hidden bg-gradient-to-b from-secondary-container/40 via-surface-container-lowest to-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                {activeRescuesCount + 10} Live Rescues Happening Now
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-display font-bold text-on-surface tracking-tight leading-tight text-balance">
              Turn Surplus Into Sustenance with{' '}
              <span className="text-primary">Predictive AI</span>
            </h1>

            <p className="text-sm sm:text-base text-on-surface-variant max-w-xl leading-relaxed">
              Live public transparency directory displaying food safety-verified surplus rescues,
              verified NGO relief hubs, and citywide redistribution impact across Unavagam.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isAuthenticated && onReturnToWorkspace ? (
                <button
                  type="button"
                  onClick={onReturnToWorkspace}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  <span>Back to My Workspace</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  <span>Register Donor, NGO or Shipper</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary">
                  verified_user
                </span>
                <span>{verifiedNgos.length} Verified NGO Partners Active</span>
              </span>
            </div>
          </div>

          {/* Visual Anchor Card */}
          <div className="lg:col-span-5">
            <div className="relative w-full rounded-xl overflow-hidden shadow-sm bg-inverse-surface text-inverse-on-surface p-5 min-h-[230px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-fixed">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  Unavagam Predictive Network
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold">
                  Active Feed
                </span>
              </div>

              <div className="my-4 space-y-2.5">
                {donations.slice(0, 2).map((don) => (
                  <div
                    key={don.id}
                    className="p-3 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {don.foodTitle}
                      </p>
                      <p className="text-[11px] text-inverse-on-surface/75 truncate">
                        {don.donorOrg} · {don.storageCondition}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-primary-fixed shrink-0">
                      {don.confirmedQuantityKg} kg
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                <span className="font-semibold text-inverse-on-surface/90">
                  Metro Pilot: 94% Waste Reduction
                </span>
                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="text-primary-fixed font-semibold hover:underline"
                  >
                    Partner Registration →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Community Impact Component */}
      <CommunityImpact />

      {/* Citywide OpenStreetMap of All Locations (Donors, NGOs, Shippers) */}
      <section className="p-5 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
              OpenStreetMap Network
            </span>
            <h2 className="text-base font-display font-bold text-on-surface">
              All Unavagam Hubs &amp; Active Corridors
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Click any NGO pin to inspect contact details, verification status, and rescue history.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'All Locations' },
                { id: 'donor', label: 'Donors' },
                { id: 'ngo', label: 'NGOs' },
                { id: 'volunteer', label: 'Shippers' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLocationFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  locationFilter === tab.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <RouteMap
          markers={cityMapData.markers}
          routes={cityMapData.routes}
          heightClass="h-80"
          onSelectMarker={(id) => {
            const ngo = users.find((u) => u.id === id && u.role === 'ngo');
            if (ngo) setSelectedNgo(ngo);
          }}
        />
      </section>

      {/* Interactive Surplus Reduction Impact Chart + Platform Capabilities */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 p-5 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Impact Analytics
              </span>
              <h3 className="text-base font-display font-bold text-on-surface">
                Today&apos;s Surplus Diverted
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold font-mono">
              {chartData.pill}
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-container-low mb-4">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'category', label: 'By Category' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartTab(tab.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
                  chartTab === tab.id
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative h-44 w-full flex flex-col justify-end pt-4">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="w-full h-px bg-outline" />
              <div className="w-full h-px bg-outline" />
              <div className="w-full h-px bg-outline" />
              <div className="w-full h-px bg-outline" />
            </div>
            <div className="relative z-10 grid grid-cols-6 gap-2.5 items-end h-36 px-1">
              {chartData.bars.map((bar) => (
                <div key={bar.label} className="flex flex-col items-center gap-1 h-full justify-end">
                  <span
                    className={`text-[11px] font-mono ${
                      bar.highlight
                        ? 'text-primary font-bold'
                        : bar.forecast
                          ? 'text-tertiary font-bold'
                          : 'text-outline'
                    }`}
                  >
                    {bar.value}
                  </span>
                  <div
                    style={{ height: bar.height }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      bar.highlight
                        ? 'bg-primary shadow-sm'
                        : bar.forecast
                          ? 'bg-tertiary-fixed'
                          : 'bg-secondary-container hover:bg-primary'
                    }`}
                  />
                  <span
                    className={`text-[11px] ${
                      bar.highlight
                        ? 'font-bold text-primary'
                        : bar.forecast
                          ? 'font-semibold text-tertiary'
                          : 'text-on-surface-variant'
                    }`}
                  >
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between bg-surface-container-low p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">
                cloud_done
              </span>
              <span className="text-xs text-on-surface font-semibold">
                Estimated CO₂ Avoided Today:
              </span>
            </div>
            <span className="text-sm font-bold font-mono text-primary">
              {co2TodayKg.toLocaleString()} kg CO₂e
            </span>
          </div>
        </div>

        {/* Capabilities Stack */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">psychology</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Predictive Demand AI</h3>
                  <p className="text-[11px] text-secondary font-semibold">
                    Campus &amp; Hotel Meal Forecasting
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                96.2% Acc.
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Trained on 7-day consumption patterns, attendance projections, and weather signals to
              detect surplus before service close—always requiring donor safety confirmation.
            </p>
            <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-tertiary">
                  query_stats
                </span>
                <span className="text-xs text-on-surface font-semibold">
                  Tonight&apos;s Kitchen Surplus Alert
                </span>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-primary font-bold shadow-sm">
                -22% Waste Preempted
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">radar</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Instant NGO Matching</h3>
                  <p className="text-[11px] text-secondary font-semibold">
                    Hyper-local Proximity Radar (&lt;5 km)
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-bold">
                &lt;180s Lock
              </span>
            </div>
            <div className="space-y-1.5">
              {verifiedNgos.map((ngo, idx) => (
                <button
                  key={ngo.id}
                  type="button"
                  onClick={() => setSelectedNgo(ngo)}
                  className="w-full text-left flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-secondary-container/45 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="text-xs font-semibold truncate text-on-surface group-hover:text-primary transition-colors">
                      {ngo.organization}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-secondary font-bold font-mono">
                      {['1.6 km', '2.8 km', '3.9 km'][idx] ?? '3.4 km'} · {ngo.capacityKg ?? 90} kg/day
                    </span>
                    <span className="material-symbols-outlined text-[15px] text-outline group-hover:text-primary transition-colors">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cold-chain + Testimonial + CTA */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 p-5 rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">ac_unit</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Cold-Chain Logistics</h3>
                  <p className="text-[11px] text-secondary font-semibold">
                    Live Temp &amp; Route Telemetry
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                SafeTemp™
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Optimized pickup-to-dropoff routing for volunteers with mandatory thermal checks,
              allergen verification, and one-tap delivery confirmation.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">thermostat</span>
              <span className="text-xs text-on-surface font-semibold">
                Crate #C-12 Internal Sensor
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-primary font-bold shadow-sm font-mono">
              3.8°C (Optimal)
            </span>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 rounded-xl bg-primary text-on-primary shadow-sm flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex text-tertiary-fixed">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="material-symbols-filled text-[16px]">
                  star
                </span>
              ))}
            </div>
            <span className="text-[11px] text-on-primary/85 font-bold uppercase tracking-wider">
              Kitchen Director Review
            </span>
          </div>
          <blockquote className="text-sm sm:text-base font-semibold italic text-on-primary leading-relaxed">
            “Unavagam trimmed our hotel banqueting waste liability by 82% in just sixty days.
            Surplus food is picked up within 20 minutes hot and intact.”
          </blockquote>
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center font-bold text-xs">
                RK
              </div>
              <div>
                <p className="text-xs font-bold text-on-primary">Chef Rajesh Kumar</p>
                <p className="text-[11px] text-on-primary/75">
                  Culinary Operations, Grand Regency Hotel
                </p>
              </div>
            </div>
            {isAuthenticated && onReturnToWorkspace ? (
              <button
                type="button"
                onClick={onReturnToWorkspace}
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-primary text-xs font-bold shadow-sm hover:bg-secondary-container transition-colors"
              >
                Back to My Workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-primary text-xs font-bold shadow-sm hover:bg-secondary-container transition-colors"
              >
                Get Started as Partner
              </button>
            )}
          </div>
        </div>
      </section>

      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </div>
  );
};
