import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEMO_AVATARS,
  INITIAL_DONATIONS,
  INITIAL_INVENTORY,
  INITIAL_NOTIFICATIONS,
  INITIAL_USERS,
} from '../data/seedData';
import {
  calculateDistanceKm,
  estimateTransitMinutes,
  rankNgosForDonation,
  resolveNeighborhoodCoordinates,
  validateFoodSafety,
} from '../services/forecastingService';
import {
  AppNotification,
  DonationStatus,
  FoodCategory,
  InventoryItem,
  StorageCondition,
  SurplusDonation,
  UserAccount,
  UserRole,
  VerificationStatus,
} from '../types/platform';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

export interface ConfirmDonationPayload {
  inventoryItemId?: string;
  foodTitle: string;
  category: FoodCategory;
  dietaryType: 'Vegetarian' | 'Vegan' | 'Non-Vegetarian' | 'Mixed';
  confirmedQuantityKg: number;
  aiSuggestedSurplusKg?: number;
  preparedAt: string;
  expiryTime: string;
  collectionDeadline: string;
  storageCondition: StorageCondition;
  temperatureC: number;
  allergens: string[];
  allergensConfirmed: boolean;
  safetyNotes: string;
  targetNgoId?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  phone: string;
  neighborhood: string;
  address: string;
  capacityKg?: number;
  vehicleType?: string;
  organizationCategory?: string;
  licenseOrRegId?: string;
  maxPayloadKg?: number;
  serviceZone?: string;
  avatarUrl?: string;
  lat?: number;
  lng?: number;
}

interface PersistedState {
  users: UserAccount[];
  inventory: InventoryItem[];
  donations: SurplusDonation[];
  notifications: AppNotification[];
  currentUserId: string | null;
}

const SESSION_KEY = 'unavagam_current_user_id';

function loadSavedUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveUserId(userId: string | null) {
  try {
    if (userId) {
      localStorage.setItem(SESSION_KEY, userId);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

interface PlatformContextValue {
  users: UserAccount[];
  inventory: InventoryItem[];
  donations: SurplusDonation[];
  notifications: AppNotification[];
  currentUser: UserAccount | null;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  pushToast: (title: string, message: string, tone?: 'success' | 'error' | 'info') => void;
  loginAsRole: (role: UserRole) => void;
  loginWithEmail: (email: string) => boolean;
  registerOrganization: (payload: RegisterPayload) => UserAccount;
  switchUserById: (userId: string) => void;
  logout: () => void;
  addInventoryItem: (
    item: Omit<InventoryItem, 'id' | 'donorId' | 'donorName' | 'historicalLogs'>
  ) => void;
  deleteInventoryItem: (id: string) => void;
  confirmAndPublishDonation: (payload: ConfirmDonationPayload) => { ok: boolean; errors?: string[] };
  claimDonationAsNgo: (donationId: string) => void;
  assignVolunteerToDonation: (donationId: string, volunteerId?: string) => void;
  advanceDeliveryStatus: (
    donationId: string,
    nextStatus: Extract<DonationStatus, 'picked_up' | 'in_transit' | 'delivered'>,
    options?: { tempC?: number; deliveryNote?: string }
  ) => void;
  updateUserVerification: (userId: string, status: VerificationStatus) => void;
  updateCurrentUserProfile: (
    updates: Partial<
      Pick<
        UserAccount,
        | 'name'
        | 'organization'
        | 'phone'
        | 'avatarUrl'
        | 'organizationCategory'
        | 'licenseOrRegId'
        | 'capacityKg'
        | 'vehicleType'
        | 'maxPayloadKg'
        | 'serviceZone'
        | 'location'
      >
    >
  ) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetDemoData: () => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(() => ({
    users: INITIAL_USERS,
    inventory: INITIAL_INVENTORY,
    donations: INITIAL_DONATIONS,
    notifications: INITIAL_NOTIFICATIONS,
    currentUserId: loadSavedUserId(),
  }));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pushToast = (
    title: string,
    message: string,
    tone: 'success' | 'error' | 'info' = 'info'
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, message, tone }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4800);
  };

  useEffect(() => {
    let active = true;
    async function loadFromSupabaseBackend() {
      try {
        const res = await fetch('/api/platform');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not load Supabase data');
        }
        if (active && Array.isArray(data.users)) {
          setState((prev) => ({
            ...prev,
            users: data.users,
            inventory: data.inventory ?? [],
            donations: data.donations ?? [],
            notifications: data.notifications ?? [],
          }));
        }
      } catch (err: any) {
        console.error('Supabase backend load error:', err);
        pushToast(
          'Database Connection Issue',
          err?.message || 'Check your .env Supabase keys and SQL tables.',
          'error'
        );
      }
    }
    loadFromSupabaseBackend();
    return () => {
      active = false;
    };
  }, []);

  const syncApi = async (url: string, method: string, body?: unknown) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Database sync failed');
      }
    } catch (err: any) {
      console.error(`Backend sync failed (${method} ${url}):`, err);
      pushToast('Sync Warning', err?.message || 'Could not save to Supabase.', 'error');
    }
  };

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const addNotification = (
    notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
  ): AppNotification => ({
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  });

  const loginAsRole = (role: UserRole) => {
    const defaultUser =
      state.users.find((u) => u.role === role && u.verificationStatus === 'verified') ??
      state.users.find((u) => u.role === role);
    if (!defaultUser) return;
    const roleLabel = role === 'volunteer' ? 'SHIPPER' : role.toUpperCase();
    saveUserId(defaultUser.id);
    setState((prev) => ({ ...prev, currentUserId: defaultUser.id }));
    pushToast(
      `Signed in as ${defaultUser.name}`,
      `${defaultUser.organization} (${roleLabel})`,
      'success'
    );
  };

  const loginWithEmail = (email: string): boolean => {
    const found = state.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!found) {
      pushToast('Account Not Found', 'No registered account matches that email address.', 'error');
      return false;
    }
    saveUserId(found.id);
    setState((prev) => ({ ...prev, currentUserId: found.id }));
    pushToast(`Welcome back, ${found.name}`, found.organization, 'success');
    return true;
  };

  const registerOrganization = (payload: RegisterPayload): UserAccount => {
    const roleDisplay =
      payload.role === 'volunteer'
        ? 'Shipper'
        : payload.role === 'ngo'
          ? 'NGO Partner'
          : payload.role === 'donor'
            ? 'Food Donor'
            : 'Admin';

    const resolvedCoords =
      typeof payload.lat === 'number' && typeof payload.lng === 'number'
        ? { lat: payload.lat, lng: payload.lng }
        : resolveNeighborhoodCoordinates(payload.neighborhood);

    const newUser: UserAccount = {
      id: `${payload.role}-${Date.now()}`,
      name: payload.name.trim(),
      email: payload.email.trim(),
      role: payload.role,
      organization: payload.organization.trim(),
      phone: payload.phone.trim() || '+91 98000 00000',
      avatarUrl: payload.avatarUrl || DEMO_AVATARS[payload.role],
      verificationStatus: payload.role === 'admin' ? 'verified' : 'pending',
      location: {
        lat: resolvedCoords.lat,
        lng: resolvedCoords.lng,
        address: payload.address.trim() || 'Central Operations Road',
        neighborhood: payload.neighborhood.trim() || 'Indiranagar',
      },
      capacityKg: payload.capacityKg,
      vehicleType: payload.vehicleType,
      organizationCategory: payload.organizationCategory?.trim(),
      licenseOrRegId: payload.licenseOrRegId?.trim(),
      maxPayloadKg: payload.maxPayloadKg,
      serviceZone: payload.serviceZone?.trim(),
      joinedAt: new Date().toISOString(),
    };

    const notif = addNotification({
      targetRoles: ['admin'],
      title: `New ${roleDisplay} Registration`,
      message: `${newUser.organization} (${roleDisplay}) registered and is awaiting verification.`,
      type: 'verification',
    });

    saveUserId(newUser.id);
    setState((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
      notifications: [notif, ...prev.notifications],
      currentUserId: newUser.id,
    }));

    void syncApi('/api/users/register', 'POST', { user: newUser, notification: notif });

    pushToast(
      `${roleDisplay} Account Registered`,
      `${newUser.organization} entered ${roleDisplay} Hub (Admin verification pending).`,
      'success'
    );
    return newUser;
  };

  const switchUserById = (userId: string) => {
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;
    const roleLabel = target.role === 'volunteer' ? 'SHIPPER' : target.role.toUpperCase();
    saveUserId(target.id);
    setState((prev) => ({ ...prev, currentUserId: target.id }));
    pushToast(
      `Switched to ${target.name}`,
      `${target.organization} · ${roleLabel}`,
      'info'
    );
  };

  const logout = () => {
    saveUserId(null);
    setState((prev) => ({ ...prev, currentUserId: null }));
  };

  const addInventoryItem = (
    item: Omit<InventoryItem, 'id' | 'donorId' | 'donorName' | 'historicalLogs'>
  ) => {
    const donor =
      currentUser?.role === 'donor'
        ? currentUser
        : state.users.find((u) => u.role === 'donor')!;

    const baseConsumed = Math.max(4, Math.round(item.preparedQtyKg * 0.72));
    const newItem: InventoryItem = {
      ...item,
      id: `inv-${Date.now()}`,
      donorId: donor.id,
      donorName: donor.organization,
      historicalLogs: [
        { dayLabel: 'Mon', preparedKg: item.preparedQtyKg, consumedKg: Math.round(baseConsumed * 1.05), attendanceRate: 84 },
        { dayLabel: 'Tue', preparedKg: item.preparedQtyKg, consumedKg: Math.round(baseConsumed * 0.98), attendanceRate: 80 },
        { dayLabel: 'Wed', preparedKg: item.preparedQtyKg, consumedKg: Math.round(baseConsumed * 0.94), attendanceRate: 78 },
        { dayLabel: 'Thu', preparedKg: item.preparedQtyKg, consumedKg: Math.round(baseConsumed * 0.96), attendanceRate: 79 },
        { dayLabel: 'Fri', preparedKg: item.preparedQtyKg + 2, consumedKg: Math.round(baseConsumed * 1.08), attendanceRate: 86 },
        { dayLabel: 'Sat', preparedKg: item.preparedQtyKg, consumedKg: Math.round(baseConsumed * 0.85), attendanceRate: 71 },
        { dayLabel: 'Sun', preparedKg: item.preparedQtyKg, consumedKg: Math.round(baseConsumed * 0.82), attendanceRate: 69 },
      ],
    };

    setState((prev) => ({
      ...prev,
      inventory: [newItem, ...prev.inventory],
    }));

    void syncApi('/api/inventory', 'POST', { item: newItem });

    pushToast('Inventory Recorded', `${newItem.itemName} (${newItem.preparedQtyKg} kg) added.`, 'success');
  };

  const deleteInventoryItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((i) => i.id !== id),
    }));
    void syncApi(`/api/inventory/${id}`, 'DELETE');
    pushToast('Inventory Removed', 'Food item removed from active kitchen log.', 'info');
  };

  const confirmAndPublishDonation = (
    payload: ConfirmDonationPayload
  ): { ok: boolean; errors?: string[] } => {
    const validation = validateFoodSafety({
      category: payload.category,
      quantityKg: payload.confirmedQuantityKg,
      preparedAt: payload.preparedAt,
      expiryTime: payload.expiryTime,
      collectionDeadline: payload.collectionDeadline,
      storageCondition: payload.storageCondition,
      temperatureC: payload.temperatureC,
      allergensConfirmed: payload.allergensConfirmed,
    });

    if (!validation.isValid) {
      pushToast('Food Safety Gate Blocked Listing', validation.errors[0], 'error');
      return { ok: false, errors: validation.errors };
    }

    const donor =
      currentUser?.role === 'donor'
        ? currentUser
        : state.users.find((u) => u.role === 'donor')!;

    const matches = rankNgosForDonation(
      donor.location,
      payload.confirmedQuantityKg,
      state.users
    );

    const recommendedIds = payload.targetNgoId
      ? [payload.targetNgoId, ...matches.map((m) => m.ngo.id).filter((id) => id !== payload.targetNgoId)]
      : matches.map((m) => m.ngo.id);

    const nowIso = new Date().toISOString();
    const newDonation: SurplusDonation = {
      id: `don-${Math.floor(1050 + Math.random() * 900)}`,
      inventoryItemId: payload.inventoryItemId,
      donorId: donor.id,
      donorName: donor.name,
      donorOrg: donor.organization,
      foodTitle: payload.foodTitle.trim(),
      category: payload.category,
      dietaryType: payload.dietaryType,
      confirmedQuantityKg: payload.confirmedQuantityKg,
      aiSuggestedSurplusKg: payload.aiSuggestedSurplusKg,
      estimatedServings: Math.round(payload.confirmedQuantityKg * 2.8),
      preparedAt: payload.preparedAt,
      collectionDeadline: payload.collectionDeadline,
      storageCondition: payload.storageCondition,
      temperatureC: payload.temperatureC,
      allergens: payload.allergens.length > 0 ? payload.allergens : ['None'],
      safetyNotes: payload.safetyNotes.trim() || 'Safety checklist verified by kitchen lead.',
      safetyVerified: true,
      status: 'published',
      recommendedNgoIds: recommendedIds,
      pickupLocation: donor.location,
      createdAt: nowIso,
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          step: 2,
          label: `AI Demand Estimate Reviewed (${payload.aiSuggestedSurplusKg ?? payload.confirmedQuantityKg} kg)`,
          actor: 'Demand Forecasting Engine',
          timestamp: nowIso,
        },
        {
          id: `tl-${Date.now()}-2`,
          step: 3,
          label: `Donor Confirmed ${payload.confirmedQuantityKg} kg & Passed Safety Check`,
          actor: donor.name,
          timestamp: nowIso,
        },
      ],
    };

    const notif = addNotification({
      targetRoles: ['ngo', 'admin'],
      title: 'New Safety-Verified Food Donation',
      message: `${donor.organization} published ${payload.confirmedQuantityKg} kg of ${payload.foodTitle} (${newDonation.estimatedServings} servings).`,
      type: 'donation',
      relatedDonationId: newDonation.id,
    });

    setState((prev) => ({
      ...prev,
      donations: [newDonation, ...prev.donations],
      notifications: [notif, ...prev.notifications],
    }));

    void syncApi('/api/donations', 'POST', { donation: newDonation, notification: notif });

    pushToast(
      'Donation Published',
      `${newDonation.confirmedQuantityKg} kg verified and broadcast to nearby NGOs.`,
      'success'
    );
    return { ok: true };
  };

  const claimDonationAsNgo = (donationId: string) => {
    const ngo =
      currentUser?.role === 'ngo'
        ? currentUser
        : state.users.find((u) => u.role === 'ngo' && u.verificationStatus === 'verified')!;

    if (ngo.verificationStatus !== 'verified') {
      pushToast(
        'Verification Required',
        'Only verified NGOs can claim food donations. Please await Admin approval.',
        'error'
      );
      return;
    }

    const target = state.donations.find((d) => d.id === donationId);
    if (!target || target.status !== 'published') return;

    const distanceKm = calculateDistanceKm(target.pickupLocation, ngo.location);
    const estimatedMinutes = estimateTransitMinutes(distanceKm);
    const nowIso = new Date().toISOString();

    const updatedDonation: SurplusDonation = {
      ...target,
      status: 'ngo_requested',
      claimedByNgoId: ngo.id,
      claimedByNgoName: ngo.organization,
      dropoffLocation: ngo.location,
      distanceKm,
      estimatedMinutes,
      timeline: [
        ...target.timeline,
        {
          id: `tl-${Date.now()}`,
          step: 4,
          label: `Claimed by ${ngo.organization} (${distanceKm} km)`,
          actor: ngo.name,
          timestamp: nowIso,
        },
      ],
    };

    const notif = addNotification({
      targetRoles: ['volunteer', 'donor', 'admin'],
      title: 'Donation Claimed · Volunteer Needed',
      message: `${ngo.organization} accepted ${target.confirmedQuantityKg} kg from ${target.donorOrg}. Route: ${distanceKm} km.`,
      type: 'delivery',
      relatedDonationId: donationId,
    });

    setState((prev) => ({
      ...prev,
      donations: prev.donations.map((d) => (d.id === donationId ? updatedDonation : d)),
      notifications: [notif, ...prev.notifications],
    }));

    void syncApi(`/api/donations/${donationId}`, 'PATCH', {
      donation: updatedDonation,
      notification: notif,
    });

    pushToast(
      'Donation Claimed',
      `Pickup route (${distanceKm} km) queued for volunteer dispatch.`,
      'success'
    );
  };

  const assignVolunteerToDonation = (donationId: string, volunteerId?: string) => {
    const volunteer = volunteerId
      ? state.users.find((u) => u.id === volunteerId)
      : currentUser?.role === 'volunteer'
        ? currentUser
        : state.users.find((u) => u.role === 'volunteer' && u.verificationStatus === 'verified');

    if (!volunteer) return;

    const target = state.donations.find((d) => d.id === donationId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const updatedDonation: SurplusDonation = {
      ...target,
      status: 'volunteer_assigned',
      assignedVolunteerId: volunteer.id,
      assignedVolunteerName: volunteer.name,
      timeline: [
        ...target.timeline,
        {
          id: `tl-${Date.now()}`,
          step: 5,
          label: `Volunteer ${volunteer.name} Assigned (${volunteer.vehicleType ?? 'Courier'})`,
          actor: volunteer.name,
          timestamp: nowIso,
        },
      ],
    };

    const notif = addNotification({
      targetRoles: ['donor', 'ngo', 'admin', 'volunteer'],
      title: 'Volunteer Assigned to Pickup',
      message: `${volunteer.name} accepted collection for ${target.foodTitle} (${target.donorOrg} → ${target.claimedByNgoName}).`,
      type: 'delivery',
      relatedDonationId: donationId,
    });

    setState((prev) => ({
      ...prev,
      donations: prev.donations.map((d) => (d.id === donationId ? updatedDonation : d)),
      notifications: [notif, ...prev.notifications],
    }));

    void syncApi(`/api/donations/${donationId}`, 'PATCH', {
      donation: updatedDonation,
      notification: notif,
    });

    pushToast('Assignment Confirmed', `${volunteer.name} assigned to ${target.foodTitle}.`, 'success');
  };

  const advanceDeliveryStatus = (
    donationId: string,
    nextStatus: Extract<DonationStatus, 'picked_up' | 'in_transit' | 'delivered'>,
    options?: { tempC?: number; deliveryNote?: string }
  ) => {
    const target = state.donations.find((d) => d.id === donationId);
    if (!target) return;

    const actorName =
      currentUser?.role === 'volunteer'
        ? currentUser.name
        : target.assignedVolunteerName ?? 'Assigned Volunteer';

    const nowIso = new Date().toISOString();
    const stepMap: Record<typeof nextStatus, { step: number; label: string }> = {
      picked_up: {
        step: 5,
        label: `Picked Up from ${target.donorOrg}${options?.tempC !== undefined ? ` (${options.tempC}°C Verified)` : ''}`,
      },
      in_transit: {
        step: 5,
        label: `In Transit to ${target.claimedByNgoName ?? 'NGO'}`,
      },
      delivered: {
        step: 6,
        label: `Delivered & Recorded (${target.estimatedServings} Meals Saved)`,
      },
    };

    const updated: SurplusDonation = {
      ...target,
      status: nextStatus,
      pickupTempCheckedC: options?.tempC ?? target.pickupTempCheckedC,
      deliveryNote: options?.deliveryNote ?? target.deliveryNote,
      timeline: [
        ...target.timeline,
        {
          id: `tl-${Date.now()}`,
          step: stepMap[nextStatus].step,
          label: stepMap[nextStatus].label,
          actor: actorName,
          timestamp: nowIso,
          note: options?.deliveryNote,
        },
      ],
    };

    const notif = addNotification({
      targetRoles: ['donor', 'ngo', 'admin'],
      title:
        nextStatus === 'delivered'
          ? 'Donation Successfully Delivered'
          : nextStatus === 'in_transit'
            ? 'Food Shipment In Transit'
            : 'Food Picked Up by Volunteer',
      message: `${target.confirmedQuantityKg} kg of ${target.foodTitle}: ${stepMap[nextStatus].label}.`,
      type: 'delivery',
      relatedDonationId: donationId,
    });

    setState((prev) => ({
      ...prev,
      donations: prev.donations.map((d) => (d.id === donationId ? updated : d)),
      notifications: [notif, ...prev.notifications],
    }));

    void syncApi(`/api/donations/${donationId}`, 'PATCH', {
      donation: updated,
      notification: notif,
    });

    pushToast(
      nextStatus === 'delivered' ? 'Delivery Completed' : 'Status Updated',
      stepMap[nextStatus].label,
      'success'
    );
  };

  const updateUserVerification = (userId: string, status: VerificationStatus) => {
    const targetUser = state.users.find((u) => u.id === userId);
    if (!targetUser) return;

    const updatedUser: UserAccount = { ...targetUser, verificationStatus: status };

    const notif = addNotification({
      targetRoles: [targetUser.role, 'admin'],
      title: `Account ${status === 'verified' ? 'Verified' : status === 'suspended' ? 'Suspended' : 'Updated'}`,
      message: `${targetUser.organization} status changed to ${status}.`,
      type: 'verification',
    });

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? updatedUser : u)),
      notifications: [notif, ...prev.notifications],
    }));

    void syncApi(`/api/users/${userId}`, 'PATCH', {
      user: updatedUser,
      notification: notif,
    });

    pushToast(
      'Organization Updated',
      `${targetUser.organization} is now ${status}.`,
      status === 'verified' ? 'success' : 'info'
    );
  };

  const updateCurrentUserProfile: PlatformContextValue['updateCurrentUserProfile'] = (
    updates
  ) => {
    if (!state.currentUserId) return;
    const existing = state.users.find((u) => u.id === state.currentUserId);
    if (!existing) return;

    const updatedUser: UserAccount = {
      ...existing,
      ...updates,
      location: updates.location ? { ...existing.location, ...updates.location } : existing.location,
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === prev.currentUserId ? updatedUser : u)),
    }));

    void syncApi(`/api/users/${existing.id}`, 'PATCH', { user: updatedUser });

    pushToast(
      'Profile & Identity Saved',
      'Your profile photo and partner identity details have been updated.',
      'success'
    );
  };

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    void syncApi(`/api/notifications/${id}/read`, 'PATCH');
  };

  const markAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
    void syncApi('/api/notifications/read-all', 'PATCH');
  };

  const resetDemoData = () => {
    setState({
      users: INITIAL_USERS,
      inventory: INITIAL_INVENTORY,
      donations: INITIAL_DONATIONS,
      notifications: INITIAL_NOTIFICATIONS,
      currentUserId: state.currentUserId,
    });
    void syncApi('/api/reset-demo', 'POST');
    pushToast('Demo Data Reset', 'All inventory, donations, and routes restored in Supabase.', 'info');
  };

  return (
    <PlatformContext.Provider
      value={{
        users: state.users,
        inventory: state.inventory,
        donations: state.donations,
        notifications: state.notifications,
        currentUser,
        toasts,
        dismissToast,
        pushToast,
        loginAsRole,
        loginWithEmail,
        registerOrganization,
        switchUserById,
        logout,
        addInventoryItem,
        deleteInventoryItem,
        confirmAndPublishDonation,
        claimDonationAsNgo,
        assignVolunteerToDonation,
        advanceDeliveryStatus,
        updateUserVerification,
        updateCurrentUserProfile,
        markNotificationRead,
        markAllNotificationsRead,
        resetDemoData,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}