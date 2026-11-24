import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { UserAccount } from '../../types/platform';
import {
  formatDateTimeShort,
  getStatusBadgeClass,
  getStatusLabel,
} from '../../utils/formatters';
import { CommunityImpact } from './CommunityImpact';
import { NgoProfileModal } from './NgoProfileModal';

export const ReportsView: React.FC = () => {
  const { donations, users, currentUser, pushToast } = usePlatform();
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'active'>('all');
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);

  const openNgoById = (ngoId?: string) => {
    if (!ngoId) return;
    const found = users.find((u) => u.id === ngoId && u.role === 'ngo');
    if (found) setSelectedNgo(found);
  };

  const scopedDonations = useMemo(() => {
    let base = donations;
    if (currentUser?.role === 'donor') {
      const own = donations.filter((d) => d.donorId === currentUser.id);
      if (own.length > 0) base = own;
    } else if (currentUser?.role === 'ngo') {
      const own = donations.filter((d) => d.claimedByNgoId === currentUser.id);
      if (own.length > 0) base = own;
    } else if (currentUser?.role === 'volunteer') {
      const own = donations.filter((d) => d.assignedVolunteerId === currentUser.id);
      if (own.length > 0) base = own;
    }

    return base.filter((d) => {
      if (statusFilter === 'delivered') return d.status === 'delivered';
      if (statusFilter === 'active') return d.status !== 'delivered';
      return true;
    });
  }, [donations, currentUser, statusFilter]);

  const handleExportCsv = () => {
    const headers = [
      'Donation ID',
      'Food Item',
      'Category',
      'Donor',
      'NGO Recipient',
      'Volunteer',
      'Quantity (kg)',
      'Est. Servings',
      'Storage Condition',
      'Temp (C)',
      'Status',
      'Created At',
    ];

    const rows = scopedDonations.map((d) => [
      d.id,
      `"${d.foodTitle.replace(/"/g, '""')}"`,
      d.category,
      `"${d.donorOrg.replace(/"/g, '""')}"`,
      `"${(d.claimedByNgoName ?? 'Unclaimed').replace(/"/g, '""')}"`,
      `"${(d.assignedVolunteerName ?? 'Unassigned').replace(/"/g, '""')}"`,
      d.confirmedQuantityKg,
      d.estimatedServings,
      `"${d.storageCondition}"`,
      d.temperatureC,
      getStatusLabel(d.status),
      d.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `smartplate-impact-report-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pushToast('CSV Report Exported', 'Impact & food redistribution ledger downloaded.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-display font-bold text-on-surface">
            Food Waste Reduction &amp; Donation Impact Report
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Auditable ledger of surplus quantities, safety temperatures, and community meals delivered.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      <CommunityImpact compact />

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-container-low/60 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-on-surface">Redistribution Audit Ledger</span>
          <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl no-print">
            {(
              [
                { id: 'all', label: 'All Records' },
                { id: 'delivered', label: 'Delivered' },
                { id: 'active', label: 'In Progress' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === tab.id
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider font-bold text-outline">
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Donor</th>
                <th className="py-3 px-4">NGO Recipient</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Safety Log</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-xs">
              {scopedDonations.map((d) => (
                <tr key={d.id} className="hover:bg-surface-container-low/40">
                  <td className="py-3 px-4">
                    <p className="font-bold text-on-surface">{d.foodTitle}</p>
                    <p className="text-on-surface-variant">{d.category}</p>
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant">{d.donorOrg}</td>
                  <td className="py-3 px-4 text-on-surface-variant">
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
                      d.claimedByNgoName ?? 'Pending'
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                    {d.confirmedQuantityKg} kg
                  </td>
                  <td className="py-3 px-4 font-mono text-on-surface-variant">
                    {d.storageCondition} · {d.pickupTempCheckedC ?? d.temperatureC}°C
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusBadgeClass(
                        d.status
                      )}`}
                    >
                      {getStatusLabel(d.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-outline">
                    {formatDateTimeShort(d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </div>
  );
};
