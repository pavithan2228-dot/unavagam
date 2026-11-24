import React, { useMemo, useRef, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { SurplusDonation, UserAccount } from '../../types/platform';
import {
  formatDateTimeShort,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
} from '../../utils/formatters';
import { NgoProfileModal } from '../shared/NgoProfileModal';
import { WorkflowStepper } from '../shared/WorkflowStepper';
import { RouteOptimizationVisualizer } from './RouteOptimizationVisualizer';

interface VolunteerDashboardProps {
  mode: 'overview' | 'routes' | 'tasks';
}

export const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ mode }) => {
  const {
    currentUser,
    users,
    donations,
    assignVolunteerToDonation,
    advanceDeliveryStatus,
  } = usePlatform();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tempCheckInputs, setTempCheckInputs] = useState<Record<string, string>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [selectedNgo, setSelectedNgo] = useState<UserAccount | null>(null);
  const visualizerRef = useRef<HTMLDivElement | null>(null);

  const openNgoById = (ngoId?: string) => {
    if (!ngoId) return;
    const found = users.find((u) => u.id === ngoId && u.role === 'ngo');
    if (found) setSelectedNgo(found);
  };

  const volunteerId = currentUser?.role === 'volunteer' ? currentUser.id : 'vol-1';
  const activeVolunteer = useMemo(
    () =>
      users.find((u) => u.id === volunteerId) ??
      users.find((u) => u.role === 'volunteer') ??
      null,
    [users, volunteerId]
  );

  const openPickupQueue = useMemo(
    () => donations.filter((d) => d.status === 'ngo_requested'),
    [donations]
  );

  const myActiveTasks = useMemo(
    () =>
      donations.filter(
        (d) =>
          d.assignedVolunteerId === volunteerId &&
          (d.status === 'volunteer_assigned' ||
            d.status === 'picked_up' ||
            d.status === 'in_transit')
      ),
    [donations, volunteerId]
  );

  const completedHistory = useMemo(
    () =>
      donations.filter(
        (d) =>
          d.status === 'delivered' &&
          (!currentUser ||
            currentUser.role !== 'volunteer' ||
            d.assignedVolunteerId === volunteerId)
      ),
    [donations, currentUser, volunteerId]
  );

  const routeFocusDonation: SurplusDonation | undefined = useMemo(() => {
    const pool = [...myActiveTasks, ...openPickupQueue];
    if (selectedTaskId) {
      return pool.find((d) => d.id === selectedTaskId) ?? pool[0];
    }
    return pool[0];
  }, [myActiveTasks, openPickupQueue, selectedTaskId]);

  const focusTaskOnVisualizer = (taskId: string) => {
    setSelectedTaskId(taskId);
    visualizerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const totalDeliveredKg = completedHistory.reduce(
    (acc, d) => acc + d.confirmedQuantityKg,
    0
  );

  return (
    <div className="space-y-5">
      {mode === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Available Pickups
              </span>
              <span className="material-symbols-outlined text-[18px] text-tertiary">
                inventory_2
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {openPickupQueue.length}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              NGO-claimed &amp; waiting
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Active Missions
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">
                local_shipping
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {myActiveTasks.length}
            </p>
            <p className="text-[11px] text-secondary font-semibold mt-1">Assigned to you</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Completed Runs
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">
                task_alt
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {completedHistory.length}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">Verified handoffs</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">
                Total Rescued
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">
                directions_bike
              </span>
            </div>
            <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface">
              {totalDeliveredKg.toFixed(1)}{' '}
              <span className="text-xs font-semibold text-secondary">kg</span>
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1 truncate">
              {currentUser?.vehicleType ?? 'Cold-Chain Courier'}
            </p>
          </div>
        </div>
      )}

      {mode !== 'tasks' && (
        <div className="space-y-5">
          <div ref={visualizerRef}>
            <RouteOptimizationVisualizer
              volunteer={activeVolunteer}
              assignedTasks={myActiveTasks}
              openQueueTasks={openPickupQueue}
              focusedTaskId={routeFocusDonation?.id ?? null}
              onFocusTask={setSelectedTaskId}
              onInspectNgo={openNgoById}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-5">
            <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 bg-surface-container-low/60">
                <h2 className="text-sm font-display font-bold text-on-surface">
                  Your Active Collection &amp; Delivery Missions
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Verify food temperature at pickup and update status through NGO handoff.
                </p>
              </div>

              {myActiveTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant">
                  No active deliveries assigned. Accept an available pickup task below to begin.
                </div>
              ) : (
                <div className="divide-y divide-surface-container">
                  {myActiveTasks.map((task) => {
                    const tempVal = tempCheckInputs[task.id] ?? String(task.temperatureC);
                    const noteVal =
                      deliveryNotes[task.id] ??
                      'Delivered sealed trays to NGO kitchen supervisor.';
                    const isFocused = routeFocusDonation?.id === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`p-5 space-y-4 transition-colors ${
                          isFocused ? 'bg-secondary-container/15' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-primary">
                                #{task.id.toUpperCase()}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getStatusBadgeClass(
                                  task.status
                                )}`}
                              >
                                {getStatusLabel(task.status)}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-on-surface mt-1.5">
                              {task.foodTitle} ({task.confirmedQuantityKg} kg)
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => focusTaskOnVisualizer(task.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary bg-secondary-container/70 hover:bg-secondary-container rounded-xl whitespace-nowrap shrink-0"
                          >
                            <span className="material-symbols-outlined text-[15px]">route</span>
                            <span>Focus on Route ({task.distanceKm ?? 3.2} km)</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-surface-container-low rounded-xl p-3.5">
                          <div>
                            <p className="text-outline font-bold uppercase text-[10px]">
                              Pickup Location (P)
                            </p>
                            <p className="font-bold text-on-surface mt-0.5">{task.donorOrg}</p>
                            <p className="text-on-surface-variant">{task.pickupLocation.address}</p>
                          </div>
                          <div>
                            <p className="text-outline font-bold uppercase text-[10px]">
                              Drop-off Location (D)
                            </p>
                            {task.claimedByNgoId && task.claimedByNgoName ? (
                              <button
                                type="button"
                                onClick={() => openNgoById(task.claimedByNgoId)}
                                className="font-bold text-primary hover:underline mt-0.5 inline-flex items-center gap-1 text-left"
                              >
                                <span>{task.claimedByNgoName}</span>
                                <span className="material-symbols-outlined text-[13px]">info</span>
                              </button>
                            ) : (
                              <p className="font-bold text-on-surface mt-0.5">
                                {task.claimedByNgoName ?? 'NGO Hub'}
                              </p>
                            )}
                            <p className="text-on-surface-variant">
                              {task.dropoffLocation?.address ?? 'Scheduled NGO address'}
                            </p>
                          </div>
                        </div>

                        <WorkflowStepper status={task.status} />

                        {task.status === 'volunteer_assigned' && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-on-surface mb-1">
                                Verify Pickup Storage Temp (°C)
                              </label>
                              <div className="relative">
                                <span className="material-symbols-outlined text-[18px] text-primary absolute left-3 top-2">
                                  thermostat
                                </span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={tempVal}
                                  onChange={(e) =>
                                    setTempCheckInputs((prev) => ({
                                      ...prev,
                                      [task.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                advanceDeliveryStatus(task.id, 'picked_up', {
                                  tempC: Number(tempVal) || task.temperatureC,
                                })
                              }
                              className="px-4 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm whitespace-nowrap"
                            >
                              Confirm Pickup &amp; Temp
                            </button>
                          </div>
                        )}

                        {task.status === 'picked_up' && (
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <span className="text-xs text-on-surface-variant">
                              Pickup temp verified at{' '}
                              <strong className="font-mono text-primary">
                                {task.pickupTempCheckedC ?? task.temperatureC}°C
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => advanceDeliveryStatus(task.id, 'in_transit')}
                              className="px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm whitespace-nowrap"
                            >
                              Start Transit to NGO
                            </button>
                          </div>
                        )}

                        {task.status === 'in_transit' && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-on-surface mb-1">
                                NGO Handoff Confirmation Note
                              </label>
                              <input
                                type="text"
                                value={noteVal}
                                onChange={(e) =>
                                  setDeliveryNotes((prev) => ({
                                    ...prev,
                                    [task.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-surface-container-low rounded-xl border border-outline-variant/40"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                advanceDeliveryStatus(task.id, 'delivered', {
                                  deliveryNote: noteVal,
                                })
                              }
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                check_circle
                              </span>
                              <span>Complete Delivery</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 bg-surface-container-low/60">
                <h2 className="text-sm font-display font-bold text-on-surface">
                  Open Collection Assignments
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Claimed by verified NGOs and ready for courier pickup.
                </p>
              </div>

              {openPickupQueue.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant">
                  All NGO-claimed donations currently have assigned volunteers.
                </div>
              ) : (
                <div className="divide-y divide-surface-container">
                  {openPickupQueue.map((task) => (
                    <div
                      key={task.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                          <span className="font-mono font-bold text-primary">
                            {task.distanceKm ?? 3.5} km
                          </span>
                          <span>·</span>
                          <span>~{task.estimatedMinutes ?? 16} min</span>
                          <span>·</span>
                          <span>Deadline {formatRelativeTime(task.collectionDeadline)}</span>
                        </div>
                        <p className="text-sm font-bold text-on-surface">
                          {task.foodTitle} ({task.confirmedQuantityKg} kg)
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Pickup: {task.donorOrg} → Drop-off:{' '}
                          {task.claimedByNgoId && task.claimedByNgoName ? (
                            <button
                              type="button"
                              onClick={() => openNgoById(task.claimedByNgoId)}
                              className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>{task.claimedByNgoName}</span>
                              <span className="material-symbols-outlined text-[13px]">info</span>
                            </button>
                          ) : (
                            task.claimedByNgoName
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => focusTaskOnVisualizer(task.id)}
                          className="px-3 py-2 text-xs font-bold text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-xl"
                        >
                          Preview Route
                        </button>
                        <button
                          type="button"
                          onClick={() => assignVolunteerToDonation(task.id, volunteerId)}
                          className="px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm"
                        >
                          Accept Task
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>

            <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-3">
              <div>
                <h3 className="text-sm font-display font-bold text-on-surface">
                  Cold-Chain Dispatch Checklist
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Safety verification protocol required on every food pickup and drop-off.
                </p>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                    thermostat
                  </span>
                  <div>
                    <p className="font-bold text-on-surface">Thermal Check Before Loading</p>
                    <p className="text-on-surface-variant mt-0.5">
                      Confirm hot batches remain above 60°C and chilled trays are at or below 5°C.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                    route
                  </span>
                  <div>
                    <p className="font-bold text-on-surface">Follow Numbered Sequence (1P → 2D)</p>
                    <p className="text-on-surface-variant mt-0.5">
                      Multi-stop routing prioritizes nearest pickups first while respecting shelf-life limits.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                    verified
                  </span>
                  <div>
                    <p className="font-bold text-on-surface">NGO Kitchen Supervisor Sign-off</p>
                    <p className="text-on-surface-variant mt-0.5">
                      Log handoff confirmation note to credit rescued meals to Community Impact.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(mode === 'overview' || mode === 'tasks') && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 bg-surface-container-low/60">
            <h2 className="text-sm font-display font-bold text-on-surface">
              Completed Delivery History
            </h2>
          </div>

          {completedHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant">
              No completed deliveries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider font-bold text-outline">
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-4 text-right">Weight</th>
                    <th className="py-3 px-4 text-right">Distance</th>
                    <th className="py-3 px-4">Pickup Temp</th>
                    <th className="py-3 px-4">Delivered At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {completedHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/40">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-on-surface">{item.foodTitle}</p>
                        <p className="text-on-surface-variant mt-0.5">{item.deliveryNote}</p>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {item.donorOrg} →{' '}
                        {item.claimedByNgoId && item.claimedByNgoName ? (
                          <button
                            type="button"
                            onClick={() => openNgoById(item.claimedByNgoId)}
                            className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>{item.claimedByNgoName}</span>
                            <span className="material-symbols-outlined text-[13px]">info</span>
                          </button>
                        ) : (
                          item.claimedByNgoName
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-on-surface">
                        {item.confirmedQuantityKg} kg
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-on-surface-variant">
                        {item.distanceKm ?? 3.0} km
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        {item.pickupTempCheckedC ?? item.temperatureC}°C
                      </td>
                      <td className="py-3.5 px-4 font-mono text-outline">
                        {formatDateTimeShort(
                          item.timeline[item.timeline.length - 1]?.timestamp ?? item.createdAt
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <NgoProfileModal ngo={selectedNgo} onClose={() => setSelectedNgo(null)} />
    </div>
  );
};
