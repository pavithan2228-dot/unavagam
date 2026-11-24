export type UserRole = 'donor' | 'ngo' | 'volunteer' | 'admin';

export type VerificationStatus = 'verified' | 'pending' | 'suspended';

export type StorageCondition = 'Hot (>60°C)' | 'Chilled (<5°C)' | 'Ambient Dry';

export type FoodCategory =
  | 'Cooked Meals'
  | 'Bakery & Bread'
  | 'Fresh Produce'
  | 'Dairy & Chilled'
  | 'Packaged & Dry';

export type DonationStatus =
  | 'published'
  | 'ngo_requested'
  | 'volunteer_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface GeoPoint {
  lat: number;
  lng: number;
  address: string;
  neighborhood: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  phone: string;
  avatarUrl: string;
  verificationStatus: VerificationStatus;
  location: GeoPoint;
  capacityKg?: number;
  dietaryFocus?: string[];
  vehicleType?: string;
  organizationCategory?: string;
  licenseOrRegId?: string;
  maxPayloadKg?: number;
  serviceZone?: string;
  joinedAt: string;
}

export interface HistoricalConsumptionPoint {
  dayLabel: string;
  preparedKg: number;
  consumedKg: number;
  attendanceRate: number;
}

export interface InventoryItem {
  id: string;
  donorId: string;
  donorName: string;
  itemName: string;
  category: FoodCategory;
  preparedQtyKg: number;
  consumedQtyKg: number;
  unitCostPerKg: number;
  preparedAt: string;
  expiryTime: string;
  storageCondition: StorageCondition;
  temperatureC: number;
  allergens: string[];
  dietaryType: 'Vegetarian' | 'Vegan' | 'Non-Vegetarian' | 'Mixed';
  historicalLogs: HistoricalConsumptionPoint[];
}

export interface ForecastScenario {
  expectedAttendancePct: number;
  dayType: 'Weekday' | 'Weekend' | 'Special Event';
  weatherCondition: 'Clear' | 'Rainy' | 'Hot';
}

export interface DemandForecastResult {
  inventoryItemId: string;
  itemName: string;
  category: FoodCategory;
  preparedQtyKg: number;
  predictedDemandKg: number;
  detectedSurplusKg: number;
  estimatedServings: number;
  confidencePct: number;
  forecastSeries: Array<{
    day: string;
    actualConsumedKg: number | null;
    predictedDemandKg: number;
    preparedKg: number;
  }>;
  rationale: string;
}

export interface DonationTimelineEvent {
  id: string;
  step: number;
  label: string;
  actor: string;
  timestamp: string;
  note?: string;
}

export interface SurplusDonation {
  id: string;
  inventoryItemId?: string;
  donorId: string;
  donorName: string;
  donorOrg: string;
  foodTitle: string;
  category: FoodCategory;
  dietaryType: 'Vegetarian' | 'Vegan' | 'Non-Vegetarian' | 'Mixed';
  confirmedQuantityKg: number;
  aiSuggestedSurplusKg?: number;
  estimatedServings: number;
  preparedAt: string;
  collectionDeadline: string;
  storageCondition: StorageCondition;
  temperatureC: number;
  allergens: string[];
  safetyNotes: string;
  safetyVerified: boolean;
  status: DonationStatus;
  recommendedNgoIds: string[];
  claimedByNgoId?: string;
  claimedByNgoName?: string;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  pickupLocation: GeoPoint;
  dropoffLocation?: GeoPoint;
  distanceKm?: number;
  estimatedMinutes?: number;
  pickupTempCheckedC?: number;
  deliveryNote?: string;
  createdAt: string;
  timeline: DonationTimelineEvent[];
}

export interface NgoMatchScore {
  ngo: UserAccount;
  distanceKm: number;
  estimatedMinutes: number;
  capacityFitPct: number;
  matchScore: number;
  matchReason: string;
}

export interface AppNotification {
  id: string;
  targetRoles: UserRole[];
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'donation' | 'safety' | 'delivery' | 'verification';
  relatedDonationId?: string;
}

export interface SafetyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  maxSafeWindowHours: number;
  remainingHours: number;
}
