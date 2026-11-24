import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { usePlatform } from '../../context/PlatformContext';
import { computeDemandForecast } from '../../services/forecastingService';
import { ForecastScenario } from '../../types/platform';
import '../shared/ChartSetup';
import { CHART_FONT_FAMILY } from '../shared/ChartSetup';
import { SurplusConfirmModal } from './SurplusConfirmModal';

interface DonorForecastingProps {
  initialItemId?: string | null;
}

export const DonorForecasting: React.FC<DonorForecastingProps> = ({ initialItemId }) => {
  const { inventory, currentUser } = usePlatform();

  const donorItems = useMemo(() => {
    const filtered =
      currentUser?.role === 'donor'
        ? inventory.filter((i) => i.donorId === currentUser.id)
        : inventory;
    return filtered.length > 0 ? filtered : inventory;
  }, [inventory, currentUser]);

  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialItemId && donorItems.some((i) => i.id === initialItemId)
      ? initialItemId
      : donorItems[0]?.id ?? ''
  );

  const [scenario, setScenario] = useState<ForecastScenario>({
    expectedAttendancePct: 86,
    dayType: 'Weekday',
    weatherCondition: 'Clear',
  });

  const [openConfirmModal, setOpenConfirmModal] = useState(false);

  const activeItem = useMemo(
    () => donorItems.find((i) => i.id === selectedItemId) ?? donorItems[0],
    [donorItems, selectedItemId]
  );

  const forecast = useMemo(() => {
    if (!activeItem) return null;
    return computeDemandForecast(activeItem, scenario);
  }, [activeItem, scenario]);

  if (!activeItem || !forecast) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-10 text-center text-sm text-on-surface-variant shadow-sm">
        Add kitchen inventory items to run AI demand forecasting.
      </div>
    );
  }

  const chartData = {
    labels: forecast.forecastSeries.map((p) => p.day),
    datasets: [
      {
        label: 'Prepared Qty (kg)',
        data: forecast.forecastSeries.map((p) => p.preparedKg),
        borderColor: '#6e7b6c',
        backgroundColor: 'rgba(110, 123, 108, 0.12)',
        borderDash: [5, 5],
        tension: 0.25,
        pointRadius: 3,
      },
      {
        label: 'Historical Consumed (kg)',
        data: forecast.forecastSeries.map((p) => p.actualConsumedKg),
        borderColor: '#0b1c30',
        backgroundColor: 'rgba(11, 28, 48, 0.08)',
        tension: 0.3,
        pointRadius: 4,
      },
      {
        label: 'AI Predicted Demand (kg)',
        data: forecast.forecastSeries.map((p) => p.predictedDemandKg),
        borderColor: '#006b2c',
        backgroundColor: 'rgba(164, 241, 178, 0.38)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { family: CHART_FONT_FAMILY, size: 12 },
          color: '#0b1c30',
          usePointStyle: true,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#eff4ff' },
        ticks: {
          color: '#6e7b6c',
          callback: (value: string | number) => `${value} kg`,
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6e7b6c' },
      },
    },
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-display font-bold text-on-surface">
            AI Demand Forecasting &amp; Surplus Detection
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Predicts service demand from 7-day kitchen logs. Surplus detections require manual safety confirmation.
          </p>
        </div>

        <div className="w-full lg:w-80">
          <select
            value={activeItem.id}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 font-semibold text-on-surface"
          >
            {donorItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName} ({item.preparedQtyKg} kg)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Prepared Batch
          </p>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface mt-1">
            {forecast.preparedQtyKg.toFixed(1)} kg
          </p>
          <p className="text-xs text-on-surface-variant mt-1">{activeItem.category}</p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
            AI Predicted Demand
          </p>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-on-surface mt-1">
            {forecast.predictedDemandKg.toFixed(1)} kg
          </p>
          <p className="text-xs text-secondary font-bold mt-1">
            Confidence {forecast.confidencePct}%
          </p>
        </div>

        <div className="bg-secondary-container/45 rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-secondary-container">
            Detected Surplus
          </p>
          <p className="text-2xl font-display font-bold font-mono tabular-nums text-primary mt-1">
            {forecast.detectedSurplusKg.toFixed(1)} kg
          </p>
          <p className="text-xs text-on-secondary-container font-semibold mt-1">
            ~{forecast.estimatedServings} meals recoverable
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
              Safety Gate
            </p>
            <p className="text-xs font-medium text-on-surface-variant mt-1">
              Human confirmation required
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenConfirmModal(true)}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Confirm Surplus</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">
                query_stats
              </span>
              <h3 className="text-sm font-bold text-on-surface">
                7-Day Consumption vs. Predicted Demand
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
              {activeItem.itemName}
            </span>
          </div>
          <div className="h-72 w-full">
            <Line data={chartData} options={chartOptions} />
          </div>
          <div className="mt-4 p-3 rounded-xl bg-surface-container-low flex items-start gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
              auto_awesome
            </span>
            <p className="leading-relaxed">{forecast.rationale}</p>
          </div>
        </div>

        <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-5">
          <div className="flex items-center gap-2 pb-2">
            <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
            <h3 className="text-sm font-bold text-on-surface">Scenario Parameters</h3>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label className="font-bold text-on-surface">Expected Guest Attendance</label>
              <span className="font-mono font-bold text-primary">
                {scenario.expectedAttendancePct}%
              </span>
            </div>
            <input
              type="range"
              min={55}
              max={120}
              value={scenario.expectedAttendancePct}
              onChange={(e) =>
                setScenario((prev) => ({
                  ...prev,
                  expectedAttendancePct: Number(e.target.value),
                }))
              }
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-outline mt-1">
              <span>Low (55%)</span>
              <span>Normal (100%)</span>
              <span>Peak (120%)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-2">
              Service Day Profile
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-container-low rounded-xl">
              {(['Weekday', 'Weekend', 'Special Event'] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setScenario((prev) => ({ ...prev, dayType: day }))}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    scenario.dayType === day
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {day === 'Special Event' ? 'Event' : day}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-2">
              Local Weather Impact
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-container-low rounded-xl">
              {(['Clear', 'Rainy', 'Hot'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setScenario((prev) => ({ ...prev, weatherCondition: w }))}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                    scenario.weatherCondition === w
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">7-Day Mean Consumption</span>
              <span className="font-mono font-bold text-on-surface">
                {(
                  activeItem.historicalLogs.reduce((a, b) => a + b.consumedKg, 0) /
                  activeItem.historicalLogs.length
                ).toFixed(1)}{' '}
                kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Current Storage Temp</span>
              <span className="font-mono font-bold text-primary">
                {activeItem.temperatureC}°C
              </span>
            </div>
          </div>
        </div>
      </div>

      {openConfirmModal && (
        <SurplusConfirmModal
          open={openConfirmModal}
          onClose={() => setOpenConfirmModal(false)}
          sourceItem={activeItem}
          aiSuggestedSurplusKg={forecast.detectedSurplusKg}
        />
      )}
    </div>
  );
};
