import {
  DemandForecastResult,
  FoodCategory,
  ForecastScenario,
  GeoPoint,
  InventoryItem,
  NgoMatchScore,
  SafetyValidationResult,
  StorageCondition,
  UserAccount,
} from '../types/platform';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export const METRO_NEIGHBORHOOD_PRESETS: Array<{
  name: string;
  lat: number;
  lng: number;
}> = [
  { name: 'Indiranagar', lat: 12.9719, lng: 77.6412 },
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Domlur', lat: 12.9592, lng: 77.6476 },
  { name: 'Jayanagar', lat: 12.9279, lng: 77.5937 },
  { name: 'Ulsoor', lat: 12.9855, lng: 77.6194 },
  { name: 'MG Road', lat: 12.9756, lng: 77.6066 },
  { name: 'Vasanth Nagar', lat: 12.9982, lng: 77.592 },
  { name: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7499 },
];

export function resolveNeighborhoodCoordinates(neighborhood: string): {
  lat: number;
  lng: number;
} {
  const query = neighborhood.trim().toLowerCase();
  const match = METRO_NEIGHBORHOOD_PRESETS.find((p) =>
    p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase())
  );
  return match ? { lat: match.lat, lng: match.lng } : { lat: 12.9716, lng: 77.618 };
}

export function calculateDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  const dist = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(dist * 10) / 10;
}

export function estimateTransitMinutes(distanceKm: number): number {
  // Urban city speed ~22 km/h + 8 min pickup/handoff buffer
  return Math.max(10, Math.round((distanceKm / 22) * 60 + 8));
}

export function computeDemandForecast(
  item: InventoryItem,
  scenario: ForecastScenario
): DemandForecastResult {
  const logs = item.historicalLogs;
  const weights = logs.map((_, idx) => idx + 1);
  const weightSum = weights.reduce((acc, w) => acc + w, 0) || 1;

  const weightedAvgConsumed =
    logs.reduce((acc, point, idx) => acc + point.consumedKg * weights[idx], 0) /
    weightSum;

  const dayFactor =
    scenario.dayType === 'Weekend'
      ? 0.88
      : scenario.dayType === 'Special Event'
        ? 1.14
        : 1.0;

  const weatherFactor =
    scenario.weatherCondition === 'Rainy'
      ? 0.91
      : scenario.weatherCondition === 'Hot'
        ? 0.96
        : 1.0;

  const attendanceFactor = Math.max(0.5, Math.min(1.4, scenario.expectedAttendancePct / 100));

  const predictedDemandKg = Math.max(
    1,
    Math.round(weightedAvgConsumed * dayFactor * weatherFactor * attendanceFactor * 10) / 10
  );

  const detectedSurplusKg = Math.max(
    0,
    Math.round((item.preparedQtyKg - predictedDemandKg) * 10) / 10
  );

  // Roughly 2.8 servings per kg of prepared food
  const estimatedServings = Math.round(detectedSurplusKg * 2.8);

  // Calculate historical variance for confidence score
  const mean =
    logs.reduce((acc, l) => acc + l.consumedKg, 0) / Math.max(1, logs.length);
  const variance =
    logs.reduce((acc, l) => acc + Math.pow(l.consumedKg - mean, 2), 0) /
    Math.max(1, logs.length);
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0.15;
  const confidencePct = Math.round(Math.max(76, Math.min(96, (1 - cv) * 100)));

  const forecastSeries = [
    ...logs.map((l) => ({
      day: l.dayLabel,
      actualConsumedKg: l.consumedKg,
      predictedDemandKg: Math.round(l.consumedKg * (0.97 + (l.attendanceRate % 7) * 0.01) * 10) / 10,
      preparedKg: l.preparedKg,
    })),
    {
      day: 'Today (Forecast)',
      actualConsumedKg: null,
      predictedDemandKg,
      preparedKg: item.preparedQtyKg,
    },
  ];

  const rationale =
    detectedSurplusKg > 0
      ? `Weighted 7-day baseline (${weightedAvgConsumed.toFixed(1)} kg) adjusted for ${scenario.dayType.toLowerCase()} (${scenario.expectedAttendancePct}% attendance, ${scenario.weatherCondition.toLowerCase()} weather) indicates ${detectedSurplusKg.toFixed(1)} kg potential surplus before service close.`
      : `Predicted demand (${predictedDemandKg.toFixed(1)} kg) meets or exceeds current preparation (${item.preparedQtyKg.toFixed(1)} kg). No surplus expected.`;

  return {
    inventoryItemId: item.id,
    itemName: item.itemName,
    category: item.category,
    preparedQtyKg: item.preparedQtyKg,
    predictedDemandKg,
    detectedSurplusKg,
    estimatedServings,
    confidencePct,
    forecastSeries,
    rationale,
  };
}

export interface SafetyValidationInput {
  category: FoodCategory;
  quantityKg: number;
  preparedAt: string;
  expiryTime: string;
  collectionDeadline: string;
  storageCondition: StorageCondition;
  temperatureC: number;
  allergensConfirmed: boolean;
}

export function validateFoodSafety(
  input: SafetyValidationInput,
  nowMs: number = Date.now()
): SafetyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const preparedMs = new Date(input.preparedAt).getTime();
  const expiryMs = new Date(input.expiryTime).getTime();
  const deadlineMs = new Date(input.collectionDeadline).getTime();

  if (Number.isNaN(preparedMs) || Number.isNaN(expiryMs) || Number.isNaN(deadlineMs)) {
    errors.push('All preparation, expiry, and collection deadline timestamps must be valid.');
  }

  if (input.quantityKg <= 0) {
    errors.push('Confirmed surplus quantity must be greater than 0 kg.');
  }

  if (expiryMs <= nowMs) {
    errors.push('Food item has already passed its expiry time and is blocked from donation.');
  }

  if (deadlineMs <= nowMs) {
    errors.push('Collection deadline must be in the future so an NGO and volunteer can safely pick up the food.');
  }

  if (deadlineMs > expiryMs) {
    errors.push('Collection deadline cannot exceed the item expiry timestamp.');
  }

  if (preparedMs > nowMs + 15 * 60 * 1000) {
    errors.push('Preparation timestamp cannot be in the future.');
  }

  const hoursSincePrep = (nowMs - preparedMs) / (1000 * 60 * 60);
  const remainingHours = Math.max(0, (expiryMs - nowMs) / (1000 * 60 * 60));

  let maxSafeWindowHours = 24;
  if (input.category === 'Cooked Meals' || input.category === 'Dairy & Chilled') {
    if (input.storageCondition === 'Ambient Dry') {
      maxSafeWindowHours = 4;
      if (hoursSincePrep > 4) {
        errors.push(
          'Cooked or dairy food held at ambient temperature for over 4 hours fails food safety standards and cannot be listed.'
        );
      } else if (hoursSincePrep > 2.5) {
        warnings.push('Approaching 4-hour ambient holding limit; prioritize immediate nearby NGO pickup.');
      }
    } else if (input.storageCondition === 'Hot (>60°C)') {
      maxSafeWindowHours = 6;
      if (input.temperatureC < 60) {
        errors.push('Hot-held food must be maintained at or above 60°C to prevent bacterial growth.');
      }
    } else if (input.storageCondition === 'Chilled (<5°C)') {
      maxSafeWindowHours = 24;
      if (input.temperatureC > 5) {
        errors.push('Chilled food must be kept at or below 5°C.');
      }
    }
  } else if (input.storageCondition === 'Chilled (<5°C)' && input.temperatureC > 5) {
    errors.push('Chilled storage requires a recorded temperature of 5°C or lower.');
  }

  if (!input.allergensConfirmed) {
    errors.push('Donor must explicitly verify allergen declarations before publishing.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    maxSafeWindowHours,
    remainingHours: Math.round(remainingHours * 10) / 10,
  };
}

export function rankNgosForDonation(
  pickupLocation: GeoPoint,
  quantityKg: number,
  ngos: UserAccount[]
): NgoMatchScore[] {
  const verifiedNgos = ngos.filter(
    (u) => u.role === 'ngo' && u.verificationStatus === 'verified'
  );

  return verifiedNgos
    .map((ngo) => {
      const distanceKm = calculateDistanceKm(pickupLocation, ngo.location);
      const estimatedMinutes = estimateTransitMinutes(distanceKm);
      const capacity = ngo.capacityKg ?? 60;
      const capacityFitPct = Math.min(100, Math.round((capacity / Math.max(1, quantityKg)) * 50 + 50));
      const proximityScore = Math.max(0, 100 - distanceKm * 7.5);
      const matchScore = Math.round(proximityScore * 0.65 + capacityFitPct * 0.35);

      const matchReason =
        distanceKm <= 4
          ? `Close proximity (${distanceKm} km) · Capacity ${capacity} kg/day`
          : `Verified kitchen (${distanceKm} km) · Capacity ${capacity} kg/day`;

      return {
        ngo,
        distanceKm,
        estimatedMinutes,
        capacityFitPct,
        matchScore,
        matchReason,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export interface OptimizedRouteStop {
  order: number;
  kind: 'pickup' | 'dropoff';
  donation: import('../types/platform').SurplusDonation;
  point: GeoPoint;
  title: string;
  subtitle: string;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
  cumulativeMinutes: number;
}

export interface RouteOptimizationResult {
  stops: OptimizedRouteStop[];
  baselineStops: OptimizedRouteStop[];
  optimizedDistanceKm: number;
  baselineDistanceKm: number;
  distanceSavedKm: number;
  savingsPct: number;
  optimizedMinutes: number;
  baselineMinutes: number;
  timeSavedMinutes: number;
  co2FuelSavedKg: number;
}

interface PendingStopCandidate {
  donation: import('../types/platform').SurplusDonation;
  kind: 'pickup' | 'dropoff';
  point: GeoPoint;
  title: string;
  subtitle: string;
}

/**
 * Computes a precedence-constrained multi-stop route (each task's drop-off
 * is eligible only after its pickup is visited, or immediately if already picked_up / in_transit).
 * Compares nearest-neighbor optimized sequence against naive per-task sequential order.
 */
export function optimizeVolunteerRoute(
  startPoint: GeoPoint,
  tasks: import('../types/platform').SurplusDonation[]
): RouteOptimizationResult {
  if (tasks.length === 0) {
    return {
      stops: [],
      baselineStops: [],
      optimizedDistanceKm: 0,
      baselineDistanceKm: 0,
      distanceSavedKm: 0,
      savingsPct: 0,
      optimizedMinutes: 0,
      baselineMinutes: 0,
      timeSavedMinutes: 0,
      co2FuelSavedKg: 0,
    };
  }

  // 1. Naive sequential baseline: complete each task's pickup -> dropoff one by one
  const baselineStops: OptimizedRouteStop[] = [];
  let baseCursor = startPoint;
  let baseCumKm = 0;

  tasks.forEach((don) => {
    const needsPickup = don.status !== 'picked_up' && don.status !== 'in_transit' && don.status !== 'delivered';
    if (needsPickup) {
      const legKm = calculateDistanceKm(baseCursor, don.pickupLocation);
      baseCumKm = Math.round((baseCumKm + legKm) * 10) / 10;
      baselineStops.push({
        order: baselineStops.length + 1,
        kind: 'pickup',
        donation: don,
        point: don.pickupLocation,
        title: don.donorOrg,
        subtitle: `${don.foodTitle} (${don.confirmedQuantityKg} kg)`,
        legDistanceKm: legKm,
        cumulativeDistanceKm: baseCumKm,
        cumulativeMinutes: Math.round((baseCumKm / 22) * 60 + baselineStops.length * 4),
      });
      baseCursor = don.pickupLocation;
    }

    if (don.dropoffLocation) {
      const legKm = calculateDistanceKm(baseCursor, don.dropoffLocation);
      baseCumKm = Math.round((baseCumKm + legKm) * 10) / 10;
      baselineStops.push({
        order: baselineStops.length + 1,
        kind: 'dropoff',
        donation: don,
        point: don.dropoffLocation,
        title: don.claimedByNgoName ?? 'NGO Hub',
        subtitle: `Deliver ${don.foodTitle}`,
        legDistanceKm: legKm,
        cumulativeDistanceKm: baseCumKm,
        cumulativeMinutes: Math.round((baseCumKm / 22) * 60 + baselineStops.length * 4),
      });
      baseCursor = don.dropoffLocation;
    }
  });

  // 2. Precedence-constrained nearest-neighbor optimization
  const pickedUpIds = new Set<string>(
    tasks
      .filter((d) => d.status === 'picked_up' || d.status === 'in_transit')
      .map((d) => d.id)
  );
  const droppedOffIds = new Set<string>();
  const optimizedStops: OptimizedRouteStop[] = [];
  let optCursor = startPoint;
  let optCumKm = 0;

  const maxIterations = tasks.length * 2 + 2;
  for (let step = 0; step < maxIterations; step++) {
    const eligible: PendingStopCandidate[] = [];

    tasks.forEach((don) => {
      if (!pickedUpIds.has(don.id) && don.status !== 'delivered') {
        eligible.push({
          donation: don,
          kind: 'pickup',
          point: don.pickupLocation,
          title: don.donorOrg,
          subtitle: `${don.foodTitle} (${don.confirmedQuantityKg} kg)`,
        });
      } else if (don.dropoffLocation && !droppedOffIds.has(don.id) && don.status !== 'delivered') {
        eligible.push({
          donation: don,
          kind: 'dropoff',
          point: don.dropoffLocation,
          title: don.claimedByNgoName ?? 'NGO Hub',
          subtitle: `Deliver ${don.foodTitle}`,
        });
      }
    });

    if (eligible.length === 0) break;

    let bestCandidate = eligible[0];
    let bestDist = calculateDistanceKm(optCursor, bestCandidate.point);

    for (let i = 1; i < eligible.length; i++) {
      const candidate = eligible[i];
      const dist = calculateDistanceKm(optCursor, candidate.point);
      if (dist < bestDist) {
        bestDist = dist;
        bestCandidate = candidate;
      }
    }

    optCumKm = Math.round((optCumKm + bestDist) * 10) / 10;
    const order = optimizedStops.length + 1;
    optimizedStops.push({
      order,
      kind: bestCandidate.kind,
      donation: bestCandidate.donation,
      point: bestCandidate.point,
      title: bestCandidate.title,
      subtitle: bestCandidate.subtitle,
      legDistanceKm: bestDist,
      cumulativeDistanceKm: optCumKm,
      cumulativeMinutes: Math.round((optCumKm / 22) * 60 + order * 4),
    });

    if (bestCandidate.kind === 'pickup') {
      pickedUpIds.add(bestCandidate.donation.id);
    } else {
      droppedOffIds.add(bestCandidate.donation.id);
    }
    optCursor = bestCandidate.point;
  }

  const optimizedDistanceKm = Math.round(optCumKm * 10) / 10;
  const baselineDistanceKm = Math.round(baseCumKm * 10) / 10;
  const distanceSavedKm = Math.max(
    0,
    Math.round((baselineDistanceKm - optimizedDistanceKm) * 10) / 10
  );
  const savingsPct =
    baselineDistanceKm > 0
      ? Math.round((distanceSavedKm / baselineDistanceKm) * 100)
      : 0;

  const optimizedMinutes =
    optimizedStops[optimizedStops.length - 1]?.cumulativeMinutes ?? 0;
  const baselineMinutes =
    baselineStops[baselineStops.length - 1]?.cumulativeMinutes ?? 0;
  const timeSavedMinutes = Math.max(0, baselineMinutes - optimizedMinutes);
  const co2FuelSavedKg = Math.round(distanceSavedKm * 0.19 * 10) / 10;

  return {
    stops: optimizedStops,
    baselineStops,
    optimizedDistanceKm,
    baselineDistanceKm,
    distanceSavedKm,
    savingsPct,
    optimizedMinutes,
    baselineMinutes,
    timeSavedMinutes,
    co2FuelSavedKg,
  };
}
