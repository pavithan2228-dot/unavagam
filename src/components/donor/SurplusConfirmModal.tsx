import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import {
  rankNgosForDonation,
  validateFoodSafety,
} from '../../services/forecastingService';
import { FoodCategory, InventoryItem, StorageCondition, UserAccount } from '../../types/platform';
import { NgoProfileModal } from '../shared/NgoProfileModal';

const ALLERGEN_OPTIONS = ['None', 'Dairy', 'Gluten', 'Nuts', 'Soy'];

interface SurplusConfirmModalProps {
  open: boolean;
  onClose: () => void;
  sourceItem?: InventoryItem | null;
  aiSuggestedSurplusKg?: number;
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const SurplusConfirmModal: React.FC<SurplusConfirmModalProps> = ({
  open,
  onClose,
  sourceItem,
  aiSuggestedSurplusKg,
}) => {
  const { currentUser, users, confirmAndPublishDonation } = usePlatform();

  const defaultPrepared = sourceItem?.preparedAt ?? new Date(Date.now() - 3600 * 1000).toISOString();
  const defaultExpiry = sourceItem?.expiryTime ?? new Date(Date.now() + 5 * 3600 * 1000).toISOString();
  const defaultDeadline = new Date(
    Math.min(new Date(defaultExpiry).getTime(), Date.now() + 3.5 * 3600 * 1000)
  ).toISOString();

  const initialQty =
    aiSuggestedSurplusKg !== undefined && aiSuggestedSurplusKg > 0
      ? aiSuggestedSurplusKg
      : sourceItem
        ? Math.max(1, Math.round((sourceItem.preparedQtyKg - sourceItem.consumedQtyKg) * 10) / 10)
        : 12;

  const [foodTitle, setFoodTitle] = useState(sourceItem?.itemName ?? '');
  const [category, setCategory] = useState<FoodCategory>(sourceItem?.category ?? 'Cooked Meals');
  const [dietaryType, setDietaryType] = useState<'Vegetarian' | 'Vegan' | 'Non-Vegetarian' | 'Mixed'>(
    sourceItem?.dietaryType ?? 'Vegetarian'
  );
  const [confirmedQty, setConfirmedQty] = useState<string>(String(initialQty));
  const [preparedAt, setPreparedAt] = useState<string>(toLocalDatetimeValue(defaultPrepared));
  const [expiryTime, setExpiryTime] = useState<string>(toLocalDatetimeValue(defaultExpiry));
  const [collectionDeadline, setCollectionDeadline] = useState<string>(
    toLocalDatetimeValue(defaultDeadline)
  );
  const [storageCondition, setStorageCondition] = useState<StorageCondition>(
    sourceItem?.storageCondition ?? 'Hot (>60°C)'
  );
  const [temperatureC, setTemperatureC] = useState<string>(
    String(sourceItem?.temperatureC ?? 65)
  );
  const [allergens, setAllergens] = useState<string[]>(sourceItem?.allergens ?? ['None']);
  const [allergensConfirmed, setAllergensConfirmed] = useState<boolean>(false);
  const [safetyNotes, setSafetyNotes] = useState<string>(
    'Sealed food-grade containers, untouched service batch.'
  );
  const [targetNgoId, setTargetNgoId] = useState<string>('');
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [inspectedNgo, setInspectedNgo] = useState<UserAccount | null>(null);

  const donorLocation = currentUser?.location ?? users[0].location;

  const rankedNgos = useMemo(
    () => rankNgosForDonation(donorLocation, Number(confirmedQty) || 10, users),
    [donorLocation, confirmedQty, users]
  );

  const liveSafety = useMemo(() => {
    return validateFoodSafety({
      category,
      quantityKg: Number(confirmedQty) || 0,
      preparedAt: new Date(preparedAt).toISOString(),
      expiryTime: new Date(expiryTime).toISOString(),
      collectionDeadline: new Date(collectionDeadline).toISOString(),
      storageCondition,
      temperatureC: Number(temperatureC) || 0,
      allergensConfirmed,
    });
  }, [
    category,
    confirmedQty,
    preparedAt,
    expiryTime,
    collectionDeadline,
    storageCondition,
    temperatureC,
    allergensConfirmed,
  ]);

  if (!open) return null;

  const toggleAllergen = (item: string) => {
    if (item === 'None') {
      setAllergens(['None']);
      return;
    }
    setAllergens((prev) => {
      const cleaned = prev.filter((a) => a !== 'None');
      if (cleaned.includes(item)) {
        const next = cleaned.filter((a) => a !== item);
        return next.length === 0 ? ['None'] : next;
      }
      return [...cleaned, item];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErrors([]);

    if (!foodTitle.trim()) {
      setSubmitErrors(['Food item title is required.']);
      return;
    }

    const res = confirmAndPublishDonation({
      inventoryItemId: sourceItem?.id,
      foodTitle,
      category,
      dietaryType,
      confirmedQuantityKg: Number(confirmedQty) || 0,
      aiSuggestedSurplusKg,
      preparedAt: new Date(preparedAt).toISOString(),
      expiryTime: new Date(expiryTime).toISOString(),
      collectionDeadline: new Date(collectionDeadline).toISOString(),
      storageCondition,
      temperatureC: Number(temperatureC) || 0,
      allergens,
      allergensConfirmed,
      safetyNotes,
      targetNgoId: targetNgoId || undefined,
    });

    if (!res.ok) {
      setSubmitErrors(res.errors ?? ['Food safety verification failed.']);
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/45 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_12px_40px_rgba(11,28,48,0.2)]">
        <div className="sticky top-0 bg-surface-container-lowest px-6 py-4 flex items-center justify-between z-10 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
          <div>
            <h2 className="text-base font-display font-bold text-on-surface">
              Confirm Surplus &amp; Food Safety Check
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Verify weight, holding temperature, and allergens before NGOs receive this listing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container rounded-full"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {aiSuggestedSurplusKg !== undefined && (
            <div className="bg-secondary-container/45 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-on-secondary-fixed">
                  AI Demand Estimate Review
                </p>
                <p className="text-xs text-on-secondary-container mt-0.5">
                  Forecast detected{' '}
                  <span className="font-mono font-bold">{aiSuggestedSurplusKg.toFixed(1)} kg</span>{' '}
                  potential surplus. Confirm actual weighed quantity below.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest text-primary font-mono text-xs font-bold shadow-sm whitespace-nowrap">
                ~{Math.round(aiSuggestedSurplusKg * 2.8)} meals
              </span>
            </div>
          )}

          {(submitErrors.length > 0 || !liveSafety.isValid) && (
            <div className="bg-error-container rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-on-error-container">
                <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
                <span>Food Safety Gate Checks</span>
              </div>
              <ul className="list-disc pl-5 text-xs text-on-error-container space-y-0.5">
                {(submitErrors.length > 0 ? submitErrors : liveSafety.errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {liveSafety.warnings.length > 0 && (
            <div className="bg-tertiary-fixed rounded-xl p-3 flex items-start gap-2 text-xs text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
              <span>{liveSafety.warnings[0]}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Food Dish / Surplus Batch Title
              </label>
              <input
                type="text"
                value={foodTitle}
                onChange={(e) => setFoodTitle(e.target.value)}
                placeholder="e.g. Vegetable Biryani & Raita Trays"
                className="w-full px-3.5 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FoodCategory)}
                className="w-full px-3 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40"
              >
                <option value="Cooked Meals">Cooked Meals</option>
                <option value="Bakery & Bread">Bakery &amp; Bread</option>
                <option value="Fresh Produce">Fresh Produce</option>
                <option value="Dairy & Chilled">Dairy &amp; Chilled</option>
                <option value="Packaged & Dry">Packaged &amp; Dry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Confirmed Surplus Weight (kg)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={confirmedQty}
                onChange={(e) => setConfirmedQty(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Storage Condition
              </label>
              <select
                value={storageCondition}
                onChange={(e) => {
                  const val = e.target.value as StorageCondition;
                  setStorageCondition(val);
                  if (val === 'Hot (>60°C)') setTemperatureC('65');
                  if (val === 'Chilled (<5°C)') setTemperatureC('3.8');
                  if (val === 'Ambient Dry') setTemperatureC('22');
                }}
                className="w-full px-3 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40"
              >
                <option value="Hot (>60°C)">Hot (&gt;60°C)</option>
                <option value="Chilled (<5°C)">Chilled (&lt;5°C)</option>
                <option value="Ambient Dry">Ambient Dry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Measured Temperature (°C)
              </label>
              <input
                type="number"
                step="0.5"
                value={temperatureC}
                onChange={(e) => setTemperatureC(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Preparation Time
              </label>
              <input
                type="datetime-local"
                value={preparedAt}
                onChange={(e) => setPreparedAt(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Expiry / Unsafe Threshold
              </label>
              <input
                type="datetime-local"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Collection Deadline
              </label>
              <input
                type="datetime-local"
                value={collectionDeadline}
                onChange={(e) => setCollectionDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Dietary Classification
              </label>
              <select
                value={dietaryType}
                onChange={(e) =>
                  setDietaryType(
                    e.target.value as 'Vegetarian' | 'Vegan' | 'Non-Vegetarian' | 'Mixed'
                  )
                }
                className="w-full px-3 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40"
              >
                <option value="Vegetarian">Vegetarian</option>
                <option value="Vegan">Vegan</option>
                <option value="Non-Vegetarian">Non-Vegetarian</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-2">
              Allergens Present
            </label>
            <div className="flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map((item) => {
                const active = allergens.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAllergen(item)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${
                      active
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-on-surface">
                Recommended Nearby Verified NGOs
              </label>
              {targetNgoId && (
                <button
                  type="button"
                  onClick={() => {
                    const found = rankedNgos.find((m) => m.ngo.id === targetNgoId)?.ngo ?? null;
                    setInspectedNgo(found);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  <span>View NGO Profile</span>
                </button>
              )}
            </div>
            <select
              value={targetNgoId}
              onChange={(e) => setTargetNgoId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40"
            >
              <option value="">Broadcast to all nearby verified NGOs</option>
              {rankedNgos.map((m) => (
                <option key={m.ngo.id} value={m.ngo.id}>
                  {m.ngo.organization} — {m.distanceKm} km ({m.estimatedMinutes} min) · Match{' '}
                  {m.matchScore}%
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">
              Packaging &amp; Hygiene Notes
            </label>
            <textarea
              rows={2}
              value={safetyNotes}
              onChange={(e) => setSafetyNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-surface-container-low cursor-pointer">
            <input
              type="checkbox"
              checked={allergensConfirmed}
              onChange={(e) => setAllergensConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-outline text-primary focus:ring-primary"
            />
            <span className="text-xs text-on-surface leading-relaxed">
              I confirm this food has not been served to guests, meets safe holding temperature
              thresholds, and all allergens are accurately declared.
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!liveSafety.isValid}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl transition-colors ${
                liveSafety.isValid
                  ? 'bg-primary hover:bg-primary-container text-on-primary shadow-sm'
                  : 'bg-surface-container text-outline cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Confirm Safety &amp; Publish</span>
            </button>
          </div>
        </form>
      </div>

      <NgoProfileModal ngo={inspectedNgo} onClose={() => setInspectedNgo(null)} />
    </div>
  );
};
