import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { UserAccount } from '../../types/platform';
import { NgoProfileModal } from './NgoProfileModal';

type ImpactPeriod = 'today' | 'week' | 'all';

interface CommunityImpactProps {
  compact?: boolean;
}

const PERIOD_BASELINES: Record<
  ImpactPeriod,
  {
    label: string;
    baselineMeals: number;
    baselineKg: number;
    baselineNgoPartners: number;
    baselineDonorPartners: number;
    baselineCompletedRuns: number;
  }
> = {
  today: {
    label: 'Today',
    baselineMeals: 420,
    baselineKg: 150,
    baselineNgoPartners: 14,
    baselineDonorPartners: 18,
    baselineCompletedRuns: 24,
  },
  week: {
    label: 'This Week',
    baselineMeals: 2680,
    baselineKg: 960,
    baselineNgoPartners: 42,
    baselineDonorPartners: 64,
    baselineCompletedRuns: 148,
  },
  all: {
    label: 'All Time',
    baselineMeals: 14850,
    baselineKg: 5300,
    baselineNgoPartners: 82,
    baselineDonorPartners: 178,
    baselineCompletedRuns: 538,
  },
};

const CO2_KG_PER_KG_FOOD = 2.5;

export const CommunityImpact: React.FC<CommunityImpactProps> = ({ compact = false }) => {
  const { donations, users } = usePlatform();
  const [period, setPeriod] = useState<ImpactPeriod>('today');
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);

  const metrics = useMemo(() => {
    const baseline = PERIOD_BASELINES[period];

    const validDonations = donations.filter((d) => d.status !== 'cancelled');
    const deliveredDonations = validDonations.filter((d) => d.status === 'delivered');
    const activeDonations = validDonations.filter((d) => d.status !== 'delivered');

    const liveKg = validDonations.reduce((sum, d) => sum + d.confirmedQuantityKg, 0);
    const liveMeals = validDonations.reduce((sum, d) => sum + d.estimatedServings, 0);
    const deliveredLiveMeals = deliveredDonations.reduce(
      (sum, d) => sum + d.estimatedServings,
      0
    );

    const verifiedNgos = users.filter(
      (u) => u.role === 'ngo' && u.verificationStatus === 'verified'
    );
    const pendingNgos = users.filter(
      (u) => u.role === 'ngo' && u.verificationStatus === 'pending'
    );
    const verifiedDonors = users.filter(
      (u) => u.role === 'donor' && u.verificationStatus === 'verified'
    );

    const totalMealsSaved = baseline.baselineMeals + liveMeals;
    const totalFoodKg = baseline.baselineKg + liveKg;
    const co2EmissionsReducedKg = Math.round(totalFoodKg * CO2_KG_PER_KG_FOOD);
    const activeNgoCount = baseline.baselineNgoPartners + verifiedNgos.length;
    const activeDonorCount = baseline.baselineDonorPartners + verifiedDonors.length;
    const totalRuns = baseline.baselineCompletedRuns + deliveredDonations.length;

    // Group rescued kg per verified NGO from live ledger
    const ngoContributionMap = new Map<string, { kg: number; meals: number; active: number }>();
    validDonations.forEach((d) => {
      if (!d.claimedByNgoId) return;
      const current = ngoContributionMap.get(d.claimedByNgoId) ?? {
        kg: 0,
        meals: 0,
        active: 0,
      };
      ngoContributionMap.set(d.claimedByNgoId, {
        kg: current.kg + d.confirmedQuantityKg,
        meals: current.meals + d.estimatedServings,
        active: current.active + (d.status !== 'delivered' ? 1 : 0),
      });
    });

    // Equivalent trees or car km avoided (approx 0.192 kg CO2/km)
    const carKmEquivalent = Math.round(co2EmissionsReducedKg / 0.192);

    return {
      totalMealsSaved,
      liveMeals,
      deliveredLiveMeals,
      inTransitCount: activeDonations.length,
      totalFoodKg,
      liveKg,
      co2EmissionsReducedKg,
      carKmEquivalent,
      activeNgoCount,
      verifiedNgos,
      pendingNgoCount: pendingNgos.length,
      activeDonorCount,
      totalRuns,
      ngoContributionMap,
    };
  }, [donations, users, period]);

  return (
    <section
      aria-label="Community Impact"
      className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-5"
    >
      {/* Header + Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold text-on-surface">
            Community Impact
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Real-time meals rescued, emissions avoided, and verified partner reach across all roles
          </p>
        </div>

        <div
          role="group"
          aria-label="Impact timeframe"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-container-low self-start sm:self-auto"
        >
          {(['today', 'week', 'all'] as const).map((key) => {
            const active = period === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {PERIOD_BASELINES[key].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Meals Saved */}
        <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant">
              Total Meals Saved
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">
              restaurant
            </span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {metrics.totalMealsSaved.toLocaleString()}
          </p>
          <p className="text-[11px] text-secondary font-semibold font-mono tabular-nums">
            +{metrics.liveMeals.toLocaleString()} live ledger · {metrics.deliveredLiveMeals} delivered
          </p>
        </div>

        {/* CO2 Emissions Reduced */}
        <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant">
              CO₂ Emissions Reduced
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">
              cloud_done
            </span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-primary">
            {metrics.co2EmissionsReducedKg.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-secondary">kg CO₂e</span>
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono tabular-nums">
            ~{metrics.carKmEquivalent.toLocaleString()} km driving offset
          </p>
        </div>

        {/* Active NGOs */}
        <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant">
              Active NGOs
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">
              volunteer_activism
            </span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {metrics.activeNgoCount}
          </p>
          <p className="text-[11px] text-secondary font-semibold font-mono tabular-nums">
            {metrics.verifiedNgos.length} local hubs verified · {metrics.pendingNgoCount} in review
          </p>
        </div>

        {/* Surplus Food Diverted */}
        <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant">
              Surplus Diverted
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">
              eco
            </span>
          </div>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
            {metrics.totalFoodKg.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-secondary">kg</span>
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono tabular-nums">
            {metrics.activeDonorCount} donors · {metrics.totalRuns} completed runs
          </p>
        </div>
      </div>

      {/* Active Verified NGOs Live Breakdown (clickable to inspect profile modal) */}
      {!compact && (
        <div className="pt-2 border-t border-surface-container space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-on-surface">
                Active Verified NGO Hubs Receiving Surplus
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Click any partner hub to view contact details, verification credentials, and rescue history
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold text-outline tabular-nums">
              {metrics.inTransitCount} active dispatches in progress
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {metrics.verifiedNgos.map((ngo) => {
              const stats = metrics.ngoContributionMap.get(ngo.id) ?? {
                kg: 0,
                meals: 0,
                active: 0,
              };
              return (
                <button
                  key={ngo.id}
                  type="button"
                  onClick={() => setSelectedNgo(ngo)}
                  className="text-left p-3.5 rounded-xl bg-surface-container-low hover:bg-secondary-container/45 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={ngo.avatarUrl}
                      alt={ngo.organization}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface group-hover:text-primary truncate transition-colors">
                        {ngo.organization}
                      </p>
                      <p className="text-[11px] text-on-surface-variant truncate">
                        {ngo.location.neighborhood} · {ngo.capacityKg ?? 100} kg/day cap
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-bold text-primary tabular-nums">
                      {stats.meals > 0 ? `${stats.meals} meals` : 'Ready'}
                    </p>
                    <p className="text-[10px] font-mono text-outline tabular-nums">
                      {stats.kg > 0 ? `${stats.kg} kg` : 'Verified'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </section>
  );
};
