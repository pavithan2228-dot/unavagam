import React, { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { usePlatform } from '../../context/PlatformContext';
import { UserAccount, UserRole } from '../../types/platform';
import {
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
  getVerificationToneClass,
} from '../../utils/formatters';
import '../shared/ChartSetup';
import { CHART_FONT_FAMILY } from '../shared/ChartSetup';
import { NgoProfileModal } from '../shared/NgoProfileModal';
import { MapMarkerItem, MapRouteLine, RouteMap } from '../shared/RouteMap';

interface AdminDashboardProps {
  mode: 'overview' | 'verifications' | 'donations' | 'users';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ mode }) => {
  const {
    users,
    donations,
    updateUserVerification,
    assignVolunteerToDonation,
  } = usePlatform();

  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [mapRoleFilter, setMapRoleFilter] = useState<'all' | 'donor' | 'ngo' | 'volunteer'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);

  const openNgoById = (ngoId?: string) => {
    if (!ngoId) return;
    const found = users.find((u) => u.id === ngoId && u.role === 'ngo');
    if (found) setSelectedNgo(found);
  };

  const pendingUsers = useMemo(
    () => users.filter((u) => u.verificationStatus === 'pending'),
    [users]
  );

  const volunteers = useMemo(
    () => users.filter((u) => u.role === 'volunteer' && u.verificationStatus === 'verified'),
    [users]
  );

  const deliveredDonations = donations.filter((d) => d.status === 'delivered');
  const totalSavedKg = donations
    .filter((d) => d.status !== 'cancelled')
    .reduce((acc, d) => acc + d.confirmedQuantityKg, 0);
  const deliveredKg = deliveredDonations.reduce((acc, d) => acc + d.confirmedQuantityKg, 0);
  const mealsServed = deliveredDonations.reduce((acc, d) => acc + d.estimatedServings, 0);
  const co2AvoidedKg = Math.round(totalSavedKg * 2.5);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (
        userSearch.trim() &&
        !u.name.toLowerCase().includes(userSearch.toLowerCase()) &&
        !u.organization.toLowerCase().includes(userSearch.toLowerCase()) &&
        !u.email.toLowerCase().includes(userSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [users, roleFilter, userSearch]);

  const weeklyBarData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
    datasets: [
      {
        label: 'Surplus Saved (kg)',
        data: [64, 72, 58, 81, 94, 112, Math.round(totalSavedKg)],
        backgroundColor: '#006b2c',
        borderRadius: 6,
      },
      {
        label: 'Unrecovered Waste (kg)',
        data: [14, 11, 13, 9, 10, 8, 6],
        backgroundColor: '#d3e4fe',
        borderRadius: 6,
      },
    ],
  };

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {
      'Cooked Meals': 0,
      'Bakery & Bread': 0,
      'Fresh Produce': 0,
      'Dairy & Chilled': 0,
      'Packaged & Dry': 0,
    };
    donations.forEach((d) => {
      map[d.category] = (map[d.category] ?? 0) + d.confirmedQuantityKg;
    });
    return map;
  }, [donations]);

  const doughnutData = {
    labels: Object.keys(categoryCounts),
    datasets: [
      {
        data: Object.values(categoryCounts),
        backgroundColor: ['#006b2c', '#1f6c3a', '#62df7d', '#a4f1b2', '#213145'],
        borderWidth: 0,
      },
    ],
  };

  const networkMapData = useMemo(() => {
    const markers: MapMarkerItem[] = [];
    const routes: MapRouteLine[] = [];

    users
      .filter((u) => u.role === 'donor' || u.role === 'ngo' || u.role === 'volunteer')
      .filter((u) => (mapRoleFilter === 'all' ? true : u.role === mapRoleFilter))
      .forEach((u) => {
        const displayRole = u.role === 'volunteer' ? 'SHIPPER' : u.role.toUpperCase();
        const markerType: MapMarkerItem['type'] =
          u.role === 'donor' ? 'donor' : u.role === 'ngo' ? 'ngo' : 'volunteer';
        markers.push({
          id: u.id,
          label: u.role === 'volunteer' ? `${u.name} · ${u.organization}` : u.organization,
          sublabel: `${displayRole} · ${u.verificationStatus}`,
          badgeText: u.role === 'donor' ? 'P' : u.role === 'ngo' ? 'D' : 'S',
          type: markerType,
          point: u.location,
        });
      });

    if (mapRoleFilter === 'all' || mapRoleFilter === 'volunteer') {
      donations
        .filter((d) => d.dropoffLocation && d.status !== 'delivered')
        .forEach((d) => {
          if (d.dropoffLocation) {
            routes.push({
              id: d.id,
              from: d.pickupLocation,
              to: d.dropoffLocation,
              label: `${d.foodTitle} (${d.confirmedQuantityKg} kg)`,
              active: d.status === 'in_transit',
            });
          }
        });
    }

    return { markers, routes };
  }, [users, donations, mapRoleFilter]);

  return (
    <div className="space-y-5">
      {mode === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                  Food Rescued
                </span>
                <span className="material-symbols-outlined text-[18px] text-primary">eco</span>
              </div>
              <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
                {totalSavedKg.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-secondary">kg</span>
              </p>
              <p className="text-[11px] text-secondary font-semibold mt-1">
                {deliveredKg.toFixed(1)} kg delivered
              </p>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                  Meals Served
                </span>
                <span className="material-symbols-outlined text-[18px] text-primary">
                  restaurant
                </span>
              </div>
              <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
                {mealsServed}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">Verified NGO receipts</p>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                  CO₂e Avoided
                </span>
                <span className="material-symbols-outlined text-[18px] text-primary">
                  cloud_done
                </span>
              </div>
              <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
                {co2AvoidedKg} <span className="text-xs font-semibold text-secondary">kg</span>
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">2.5 kg CO₂e / kg food</p>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                  Pending Review
                </span>
                <span className="material-symbols-outlined text-[18px] text-tertiary">
                  verified_user
                </span>
              </div>
              <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
                {pendingUsers.length}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {users.length} total accounts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <h2 className="text-sm font-display font-bold text-on-surface mb-4">
                7-Day Surplus Recovery vs. Kitchen Waste
              </h2>
              <div className="h-72">
                <Bar
                  data={weeklyBarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: { font: { family: CHART_FONT_FAMILY, size: 12 } },
                      },
                    },
                    scales: {
                      y: { beginAtZero: true, grid: { color: '#eff4ff' } },
                      x: { grid: { display: false } },
                    },
                  }}
                />
              </div>
            </div>

            <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col">
              <h2 className="text-sm font-display font-bold text-on-surface mb-4">
                Redistribution by Category
              </h2>
              <div className="flex-1 min-h-[240px] flex items-center justify-center">
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          boxWidth: 10,
                          font: { family: CHART_FONT_FAMILY, size: 11 },
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-display font-bold text-on-surface">
                  Live City Redistribution Network
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  All registered Donors, verified NGOs, Shippers, and active delivery corridors.
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
                    onClick={() => setMapRoleFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      mapRoleFilter === tab.id
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
              markers={networkMapData.markers}
              routes={networkMapData.routes}
              heightClass="h-80"
              onSelectMarker={(id) => openNgoById(id)}
            />
          </div>
        </>
      )}

      {(mode === 'overview' || mode === 'verifications') && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 bg-surface-container-low/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-display font-bold text-on-surface">
                Organization Verification Queue
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Approve food safety credentials for pending Donors and NGOs.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-mono font-bold">
              {pendingUsers.length} Pending
            </span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant">
              All registered organizations have been reviewed.
            </div>
          ) : (
            <div className="divide-y divide-surface-container">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={u.avatarUrl}
                      alt={u.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover shadow-sm shrink-0"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span className="font-bold text-primary uppercase">
                          {u.role === 'volunteer' ? 'SHIPPER' : u.role}
                        </span>
                        {u.organizationCategory && (
                          <>
                            <span>·</span>
                            <span>{u.organizationCategory}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{u.location.neighborhood}</span>
                        <span>·</span>
                        <span>Applied {formatRelativeTime(u.joinedAt)}</span>
                      </div>
                      {u.role === 'ngo' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedNgo(u)}
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline mt-0.5 text-left"
                        >
                          <span>{u.organization}</span>
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                        </button>
                      ) : (
                        <p className="text-sm font-bold text-on-surface mt-0.5">{u.organization}</p>
                      )}
                      <p className="text-xs text-on-surface-variant">
                        Contact: {u.name} ({u.email}) · {u.phone}
                        {u.licenseOrRegId ? ` · ID: ${u.licenseOrRegId}` : ''}
                        {u.vehicleType ? ` · ${u.vehicleType}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateUserVerification(u.id, 'suspended')}
                      className="px-3.5 py-2 text-xs font-bold text-on-error-container bg-error-container hover:opacity-90 rounded-xl transition-opacity"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUserVerification(u.id, 'verified')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>Verify Organization</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'donations' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 bg-surface-container-low/60">
            <h2 className="text-sm font-display font-bold text-on-surface">
              Platform-Wide Donations &amp; Volunteer Dispatch Monitor
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Oversee every food batch across donor kitchens, NGO claims, and active deliveries.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider font-bold text-outline">
                  <th className="py-3 px-4">ID &amp; Dish</th>
                  <th className="py-3 px-4">Donor</th>
                  <th className="py-3 px-4">NGO Recipient</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Volunteer Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {donations.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-on-surface">{d.foodTitle}</p>
                      <p className="font-mono text-primary mt-0.5">#{d.id.toUpperCase()}</p>
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">{d.donorOrg}</td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {d.claimedByNgoName && d.claimedByNgoId ? (
                        <button
                          type="button"
                          onClick={() => openNgoById(d.claimedByNgoId)}
                          className="font-semibold text-primary hover:underline inline-flex items-center gap-1 text-left"
                        >
                          <span>{d.claimedByNgoName}</span>
                          <span className="material-symbols-outlined text-[13px]">info</span>
                        </button>
                      ) : (
                        d.claimedByNgoName ?? '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-on-surface">
                      {d.confirmedQuantityKg} kg
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusBadgeClass(
                          d.status
                        )}`}
                      >
                        {getStatusLabel(d.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {d.status === 'ngo_requested' ? (
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignVolunteerToDonation(d.id, e.target.value);
                            }
                          }}
                          className="px-2.5 py-1.5 text-xs bg-secondary-container text-on-secondary-container rounded-xl font-bold"
                        >
                          <option value="" disabled>
                            Assign Volunteer...
                          </option>
                          {volunteers.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.location.neighborhood})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-on-surface font-medium">
                          {d.assignedVolunteerName ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'users' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-4 bg-surface-container-low/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Users' },
                  { id: 'donor', label: 'Donors' },
                  { id: 'ngo', label: 'NGOs' },
                  { id: 'volunteer', label: 'Volunteers' },
                  { id: 'admin', label: 'Admins' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRoleFilter(t.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    roleFilter === t.id
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-2">
                search
              </span>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search organization or email..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-surface-container-lowest rounded-xl border border-outline-variant/40"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider font-bold text-outline">
                  <th className="py-3 px-4">Organization / Contact</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Neighborhood</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3.5 px-4">
                      {u.role === 'ngo' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedNgo(u)}
                          className="font-bold text-primary hover:underline inline-flex items-center gap-1 text-left"
                        >
                          <span>{u.organization}</span>
                          <span className="material-symbols-outlined text-[14px]">info</span>
                        </button>
                      ) : (
                        <p className="font-bold text-on-surface">{u.organization}</p>
                      )}
                      <p className="text-on-surface-variant">
                        {u.name} · {u.email}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 uppercase font-mono font-bold text-on-surface-variant">
                      {u.role}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {u.location.neighborhood}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-bold capitalize ${getVerificationToneClass(
                        u.verificationStatus
                      )}`}
                    >
                      {u.verificationStatus}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.role !== 'admin' && (
                        <div className="inline-flex items-center gap-2">
                          {u.verificationStatus !== 'verified' && (
                            <button
                              type="button"
                              onClick={() => updateUserVerification(u.id, 'verified')}
                              className="px-3 py-1.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl"
                            >
                              Verify
                            </button>
                          )}
                          {u.verificationStatus === 'verified' && (
                            <button
                              type="button"
                              onClick={() => updateUserVerification(u.id, 'suspended')}
                              className="px-3 py-1.5 text-xs font-bold text-on-error-container bg-error-container hover:opacity-90 rounded-xl"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </div>
  );
};
