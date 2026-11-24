import React from 'react';
import { DonationStatus } from '../../types/platform';

const WORKFLOW_STEPS = [
  { step: 1, label: 'Inventory' },
  { step: 2, label: 'AI Forecast' },
  { step: 3, label: 'Safety Confirm' },
  { step: 4, label: 'NGO Match' },
  { step: 5, label: 'Transit' },
  { step: 6, label: 'Delivered' },
];

export function statusToStep(status: DonationStatus): number {
  switch (status) {
    case 'published':
      return 3;
    case 'ngo_requested':
      return 4;
    case 'volunteer_assigned':
    case 'picked_up':
    case 'in_transit':
      return 5;
    case 'delivered':
      return 6;
    default:
      return 3;
  }
}

export const WorkflowStepper: React.FC<{ status: DonationStatus }> = ({ status }) => {
  const currentStep = statusToStep(status);

  return (
    <div className="w-full overflow-x-auto py-1">
      <ol className="flex items-center min-w-[520px] justify-between gap-2">
        {WORKFLOW_STEPS.map((item, idx) => {
          const isCompleted = item.step < currentStep || (item.step === 6 && currentStep === 6);
          const isCurrent = item.step === currentStep && currentStep < 6;

          return (
            <React.Fragment key={item.step}>
              <li className="flex items-center gap-2 shrink-0">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                    isCompleted
                      ? 'bg-primary text-on-primary'
                      : isCurrent
                        ? 'bg-secondary-container text-on-secondary-container ring-2 ring-primary'
                        : 'bg-surface-container-low text-outline'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    item.step
                  )}
                </span>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isCompleted || isCurrent ? 'text-on-surface' : 'text-outline'
                  }`}
                >
                  {item.label}
                </span>
              </li>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 min-w-[14px] rounded-full ${
                    item.step < currentStep ? 'bg-primary' : 'bg-surface-container-high'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
};
