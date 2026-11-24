import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { FoodCategory, InventoryItem, StorageCondition } from '../../types/platform';
import { formatRelativeTime } from '../../utils/formatters';
import { SurplusConfirmModal } from './SurplusConfirmModal';

interface DonorInventoryProps {
  onNavigateToForecast: (itemId: string) => void;
}

export const DonorInventory: React.FC<DonorInventoryProps> = ({
  onNavigateToForecast,
}) => {
  const { inventory, currentUser, addInventoryItem, deleteInventoryItem } = usePlatform();

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'safe' | 'expiring' | 'expired'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmItem, setConfirmItem] = useState<InventoryItem | null>(null);

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Cooked Meals');
  const [preparedQtyKg, setPreparedQtyKg] = useState('45');
  const [consumedQtyKg, setConsumedQtyKg] = useState('28');
  const [storageCondition, setStorageCondition] = useState<StorageCondition>('Hot (>60°C)');
  const [temperatureC, setTemperatureC] = useState('65');
  const [hoursUntilExpiry, setHoursUntilExpiry] = useState('5');
  const [dietaryType, setDietaryType] = useState<
    'Vegetarian' | 'Vegan' | 'Non-Vegetarian' | 'Mixed'
  >('Vegetarian');
  const [formError, setFormError] = useState('');

  const donorInventory = useMemo(() => {
    if (!currentUser || currentUser.role !== 'donor') return inventory;
    const own = inventory.filter((i) => i.donorId === currentUser.id);
    return own.length > 0 ? own : inventory;
  }, [inventory, currentUser]);

  const getItemSafetyState = (item: InventoryItem): 'safe' | 'expiring' | 'expired' => {
    const remainingMs = new Date(item.expiryTime).getTime() - Date.now();
    if (remainingMs <= 0) return 'expired';
    if (remainingMs <= 3 * 3600 * 1000) return 'expiring';
    return 'safe';
  };

  const filteredItems = useMemo(() => {
    return donorInventory.filter((item) => {
      const safetyState = getItemSafetyState(item);
      if (filterTab !== 'all' && safetyState !== filterTab) return false;
      if (
        search.trim() &&
        !item.itemName.toLowerCase().includes(search.toLowerCase()) &&
        !item.category.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [donorInventory, filterTab, search]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const prep = Number(preparedQtyKg);
    const cons = Number(consumedQtyKg);
    const expH = Number(hoursUntilExpiry);

    if (!itemName.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (Number.isNaN(prep) || prep <= 0) {
      setFormError('Prepared quantity must be greater than 0 kg.');
      return;
    }
    if (Number.isNaN(cons) || cons < 0 || cons > prep) {
      setFormError('Consumed quantity must be between 0 and prepared quantity.');
      return;
    }

    addInventoryItem({
      itemName: itemName.trim(),
      category,
      preparedQtyKg: prep,
      consumedQtyKg: cons,
      unitCostPerKg: 145,
      preparedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      expiryTime: new Date(Date.now() + expH * 3600 * 1000).toISOString(),
      storageCondition,
      temperatureC: Number(temperatureC) || 22,
      allergens: ['None'],
      dietaryType,
    });

    setItemName('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-display font-bold text-on-surface">
            Kitchen Inventory &amp; Batch Safety Log
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Track prepared quantities, consumption, expiry thresholds, and storage temperatures.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Add Food Batch</span>
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-container-low/60">
          <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All Batches' },
                { id: 'safe', label: 'Safe' },
                { id: 'expiring', label: 'Expiring Soon' },
                { id: 'expired', label: 'Expired / Blocked' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  filterTab === tab.id
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search food item or category..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-bold text-on-surface">
              No inventory batches match this filter.
            </p>
            <p className="text-xs text-on-surface-variant">
              Add a prepared kitchen batch or switch the status filter above.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl"
            >
              Log First Food Batch
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider font-bold text-outline">
                  <th className="py-3 px-4">Food Item</th>
                  <th className="py-3 px-4 text-right">Prepared</th>
                  <th className="py-3 px-4 text-right">Consumed</th>
                  <th className="py-3 px-4 text-right">Remaining</th>
                  <th className="py-3 px-4">Storage</th>
                  <th className="py-3 px-4">Safety Window</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-sm">
                {filteredItems.map((item) => {
                  const safety = getItemSafetyState(item);
                  const remainingKg = Math.max(0, item.preparedQtyKg - item.consumedQtyKg);

                  return (
                    <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-on-surface">{item.itemName}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {item.category} · {item.dietaryType}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-on-surface-variant">
                        {item.preparedQtyKg.toFixed(1)} kg
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-on-surface-variant">
                        {item.consumedQtyKg.toFixed(1)} kg
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-on-surface">
                        {remainingKg.toFixed(1)} kg
                      </td>
                      <td className="py-3.5 px-4 text-xs text-on-surface-variant">
                        <span>{item.storageCondition}</span>
                        <span className="mx-1.5 text-outline-variant">·</span>
                        <span className="font-mono font-semibold text-on-surface">
                          {item.temperatureC}°C
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {safety === 'expired' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-bold">
                            <span className="material-symbols-outlined text-[14px]">gpp_bad</span>
                            <span>Expired ({formatRelativeTime(item.expiryTime)})</span>
                          </span>
                        ) : safety === 'expiring' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-bold">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            <span>Expires {formatRelativeTime(item.expiryTime)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-bold">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>Safe · {formatRelativeTime(item.expiryTime)}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigateToForecast(item.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-lg transition-colors whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-[15px] text-primary">
                              psychology
                            </span>
                            <span>Forecast</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmItem(item)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                              safety === 'expired'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-primary hover:bg-primary-container text-on-primary shadow-sm'
                            }`}
                          >
                            {safety === 'expired' ? 'Inspect Safety' : 'Confirm Surplus'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteInventoryItem(item.id)}
                            className="p-1.5 text-outline hover:text-error rounded-lg transition-colors"
                            aria-label="Delete inventory batch"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/45 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-display font-bold text-on-surface">
              Log Kitchen Food Batch
            </h3>
            {formError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Dish / Batch Name
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Chapati, Dal Fry & Jeera Rice"
                  className="w-full px-3.5 py-2 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
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
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Dietary Type
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Prepared Qty (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={preparedQtyKg}
                    onChange={(e) => setPreparedQtyKg(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Consumed So Far (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={consumedQtyKg}
                    onChange={(e) => setConsumedQtyKg(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Storage
                  </label>
                  <select
                    value={storageCondition}
                    onChange={(e) => setStorageCondition(e.target.value as StorageCondition)}
                    className="w-full px-2.5 py-2 text-xs bg-surface-container-low rounded-xl border border-outline-variant/40"
                  >
                    <option value="Hot (>60°C)">Hot (&gt;60°C)</option>
                    <option value="Chilled (<5°C)">Chilled (&lt;5°C)</option>
                    <option value="Ambient Dry">Ambient Dry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={temperatureC}
                    onChange={(e) => setTemperatureC(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Safe For (hrs)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={hoursUntilExpiry}
                    onChange={(e) => setHoursUntilExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmItem && (
        <SurplusConfirmModal
          open={Boolean(confirmItem)}
          onClose={() => setConfirmItem(null)}
          sourceItem={confirmItem}
        />
      )}
    </div>
  );
};
