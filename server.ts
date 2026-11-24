import 'dotenv/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_DONATIONS,
  INITIAL_INVENTORY,
  INITIAL_NOTIFICATIONS,
  INITIAL_USERS,
} from './src/data/seedData';
import type {
  AppNotification,
  InventoryItem,
  SurplusDonation,
  UserAccount,
} from './src/types/platform';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let wsImpl: unknown;
try {
  const require = createRequire(import.meta.url);
  wsImpl = require('ws');
  if (!globalThis.WebSocket && wsImpl) {
    (globalThis as Record<string, unknown>).WebSocket = wsImpl;
  }
} catch {
  // Handled below if ws is missing
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface PlatformChatContext {
  userName?: string;
  userRole?: string;
  organization?: string;
  totalDonations?: number;
  publishedListings?: Array<{
    foodTitle: string;
    quantityKg: number;
    donorOrg: string;
    storageCondition: string;
    temperatureC: number;
    neighborhood: string;
  }>;
  verifiedNgos?: Array<{
    organization: string;
    neighborhood: string;
    capacityKg?: number;
  }>;
  totalSavedKg?: number;
  totalMeals?: number;
}

const SYSTEM_INSTRUCTION = `நீங்கள் "Unavagam" என்ற AI உணவு மேலாண்மை மற்றும் உபரி உணவு பகிர்வு தளத்தின் தமிழ் AI உதவியாளர்.

உங்கள் முக்கியப் பொறுப்புகள்:
1. எப்போதும் தெளிவான, இயல்பான, மரியாதையான **தமிழ் மொழியில்** மட்டுமே பதிலளிக்க வேண்டும் (பயனர் ஆங்கிலம் அல்லது தங்கிலீஷில் கேட்டாலும் முதன்மையாகத் தமிழில் பதில் அளிக்கவும்; உணவுப் பெயர்கள், °C, kg போன்ற அளவுகள் மற்றும் நிறுவனப் பெயர்களைத் தெளிவாகக் குறிப்பிடலாம்).
2. உணவு தானம் செய்பவர்கள் (Food Donors), NGO தொண்டு நிறுவனங்கள், விநியோகத் தன்னார்வலர்கள் / Shippers மற்றும் நிர்வாகிகளுக்கு (Admin) உதவுங்கள்.
3. "Unavagam" தளத்தின் 6-படி உணவு மீட்பு செயல்முறை பற்றி வழிகாட்டுங்கள்:
   - படி 1: உணவு தானம் செய்பவர் இருப்பு மற்றும் நுகர்வுத் தரவைப் பதிவு செய்தல்.
   - படி 2: AI தேவை முன்னறிவிப்பு (Demand Forecasting) மூலம் உபரி உணவைக் கண்டறிதல்.
   - படி 3: உணவுப் பாதுகாப்பு சோதனை (Food Safety Gate) — சமைத்த நேரம், காலாவதி நேரம், சேமிப்பு வெப்பநிலை (சூடான உணவு >60°C, குளிரூட்டப்பட்ட உணவு <5°C), மற்றும் ஒவ்வாமை (Allergens) உறுதிப்படுத்தி வெளியிடுதல்.
   - படி 4: அருகிலுள்ள சரிபார்க்கப்பட்ட NGO-கள் உணவைக் கோரி ஏற்றல்.
   - படி 5: தன்னார்வலர் பிக்-அப் மற்றும் வெப்பநிலை சரிபார்ப்புடன் விநியோகித்தல்.
   - படி 6: வெற்றிகரமான ஒப்படைப்பு மற்றும் சமூகத் தாக்கப் பதிவு (Community Impact).
4. கீழே வழங்கப்படும் நேரடித் தளத் தரவுகளை (Live Platform Context) அடிப்படையாகக் கொண்டு துல்லியமான பதில்களை வழங்குங்கள். தரவுகளில் இல்லாத தகவலை யூகிக்காதீர்கள்.
5. பதில்களை சுருக்கமாகவும், புள்ளிகள் (bullet points) வடிவில் எளிதாகப் படிக்கக்கூடியதாகவும் வழங்குங்கள்.`;

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

let supabaseConfigError: string | null = null;

function createSupabaseAdminClient(): SupabaseClient | null {
  supabaseConfigError = null;
  const url = process.env.SUPABASE_URL?.trim().replace(/^["']|["']$/g, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '');

  if (!url || !serviceKey) {
    supabaseConfigError = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env';
    return null;
  }

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    supabaseConfigError = `Invalid SUPABASE_URL in .env ("${url}"). It must start with https://`;
    return null;
  }

  try {
    return createClient(url, serviceKey, {
      auth: { persistSession: false },
      ...(wsImpl ? { realtime: { transport: wsImpl as any } } : {}),
    });
  } catch (err: any) {
    supabaseConfigError = err?.message || 'Failed to initialize Supabase client';
    console.error('Supabase initialization error:', supabaseConfigError);
    return null;
  }
}

function userToRow(u: UserAccount) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organization: u.organization,
    phone: u.phone,
    avatar_url: u.avatarUrl,
    verification_status: u.verificationStatus,
    location: u.location,
    capacity_kg: u.capacityKg ?? null,
    dietary_focus: u.dietaryFocus ?? null,
    vehicle_type: u.vehicleType ?? null,
    organization_category: u.organizationCategory ?? null,
    license_or_reg_id: u.licenseOrRegId ?? null,
    max_payload_kg: u.maxPayloadKg ?? null,
    service_zone: u.serviceZone ?? null,
    joined_at: u.joinedAt,
  };
}

function rowToUser(r: Record<string, any>): UserAccount {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    organization: r.organization,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    verificationStatus: r.verification_status,
    location: r.location,
    capacityKg: r.capacity_kg != null ? Number(r.capacity_kg) : undefined,
    dietaryFocus: r.dietary_focus ?? undefined,
    vehicleType: r.vehicle_type ?? undefined,
    organizationCategory: r.organization_category ?? undefined,
    licenseOrRegId: r.license_or_reg_id ?? undefined,
    maxPayloadKg: r.max_payload_kg != null ? Number(r.max_payload_kg) : undefined,
    serviceZone: r.service_zone ?? undefined,
    joinedAt: r.joined_at,
  };
}

function inventoryToRow(i: InventoryItem) {
  return {
    id: i.id,
    donor_id: i.donorId,
    donor_name: i.donorName,
    item_name: i.itemName,
    category: i.category,
    prepared_qty_kg: i.preparedQtyKg,
    consumed_qty_kg: i.consumedQtyKg,
    unit_cost_per_kg: i.unitCostPerKg,
    prepared_at: i.preparedAt,
    expiry_time: i.expiryTime,
    storage_condition: i.storageCondition,
    temperature_c: i.temperatureC,
    allergens: i.allergens,
    dietary_type: i.dietaryType,
    historical_logs: i.historicalLogs,
  };
}

function rowToInventory(r: Record<string, any>): InventoryItem {
  return {
    id: r.id,
    donorId: r.donor_id,
    donorName: r.donor_name,
    itemName: r.item_name,
    category: r.category,
    preparedQtyKg: Number(r.prepared_qty_kg),
    consumedQtyKg: Number(r.consumed_qty_kg),
    unitCostPerKg: Number(r.unit_cost_per_kg),
    preparedAt: r.prepared_at,
    expiryTime: r.expiry_time,
    storageCondition: r.storage_condition,
    temperatureC: Number(r.temperature_c),
    allergens: r.allergens ?? [],
    dietaryType: r.dietary_type,
    historicalLogs: r.historical_logs ?? [],
  };
}

function donationToRow(d: SurplusDonation) {
  return {
    id: d.id,
    inventory_item_id: d.inventoryItemId ?? null,
    donor_id: d.donorId,
    donor_name: d.donorName,
    donor_org: d.donorOrg,
    food_title: d.foodTitle,
    category: d.category,
    dietary_type: d.dietaryType,
    confirmed_quantity_kg: d.confirmedQuantityKg,
    ai_suggested_surplus_kg: d.aiSuggestedSurplusKg ?? null,
    estimated_servings: d.estimatedServings,
    prepared_at: d.preparedAt,
    collection_deadline: d.collectionDeadline,
    storage_condition: d.storageCondition,
    temperature_c: d.temperatureC,
    allergens: d.allergens,
    safety_notes: d.safetyNotes,
    safety_verified: d.safetyVerified,
    status: d.status,
    recommended_ngo_ids: d.recommendedNgoIds,
    claimed_by_ngo_id: d.claimedByNgoId ?? null,
    claimed_by_ngo_name: d.claimedByNgoName ?? null,
    assigned_volunteer_id: d.assignedVolunteerId ?? null,
    assigned_volunteer_name: d.assignedVolunteerName ?? null,
    pickup_location: d.pickupLocation,
    dropoff_location: d.dropoffLocation ?? null,
    distance_km: d.distanceKm ?? null,
    estimated_minutes: d.estimatedMinutes ?? null,
    pickup_temp_checked_c: d.pickupTempCheckedC ?? null,
    delivery_note: d.deliveryNote ?? null,
    created_at: d.createdAt,
    timeline: d.timeline,
  };
}

function rowToDonation(r: Record<string, any>): SurplusDonation {
  return {
    id: r.id,
    inventoryItemId: r.inventory_item_id ?? undefined,
    donorId: r.donor_id,
    donorName: r.donor_name,
    donorOrg: r.donor_org,
    foodTitle: r.food_title,
    category: r.category,
    dietaryType: r.dietary_type,
    confirmedQuantityKg: Number(r.confirmed_quantity_kg),
    aiSuggestedSurplusKg:
      r.ai_suggested_surplus_kg != null ? Number(r.ai_suggested_surplus_kg) : undefined,
    estimatedServings: Number(r.estimated_servings),
    preparedAt: r.prepared_at,
    collectionDeadline: r.collection_deadline,
    storageCondition: r.storage_condition,
    temperatureC: Number(r.temperature_c),
    allergens: r.allergens ?? [],
    safetyNotes: r.safety_notes,
    safetyVerified: Boolean(r.safety_verified),
    status: r.status,
    recommendedNgoIds: r.recommended_ngo_ids ?? [],
    claimedByNgoId: r.claimed_by_ngo_id ?? undefined,
    claimedByNgoName: r.claimed_by_ngo_name ?? undefined,
    assignedVolunteerId: r.assigned_volunteer_id ?? undefined,
    assignedVolunteerName: r.assigned_volunteer_name ?? undefined,
    pickupLocation: r.pickup_location,
    dropoffLocation: r.dropoff_location ?? undefined,
    distanceKm: r.distance_km != null ? Number(r.distance_km) : undefined,
    estimatedMinutes:
      r.estimated_minutes != null ? Number(r.estimated_minutes) : undefined,
    pickupTempCheckedC:
      r.pickup_temp_checked_c != null ? Number(r.pickup_temp_checked_c) : undefined,
    deliveryNote: r.delivery_note ?? undefined,
    createdAt: r.created_at,
    timeline: r.timeline ?? [],
  };
}

function notificationToRow(n: AppNotification) {
  return {
    id: n.id,
    target_roles: n.targetRoles,
    title: n.title,
    message: n.message,
    timestamp: n.timestamp,
    read: n.read,
    type: n.type,
    related_donation_id: n.relatedDonationId ?? null,
  };
}

function rowToNotification(r: Record<string, any>): AppNotification {
  return {
    id: r.id,
    targetRoles: r.target_roles ?? [],
    title: r.title,
    message: r.message,
    timestamp: r.timestamp,
    read: Boolean(r.read),
    type: r.type,
    relatedDonationId: r.related_donation_id ?? undefined,
  };
}

let seedPromise: Promise<void> | null = null;

async function seedDatabaseIfEmpty(supabase: SupabaseClient) {
  if (seedPromise) {
    await seedPromise;
    return;
  }

  seedPromise = (async () => {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(error.message);
    }

    if ((count ?? 0) === 0) {
      console.log('Supabase users table is empty. Seeding initial Unavagam demo data...');

      const { error: usersErr } = await supabase
        .from('users')
        .upsert(INITIAL_USERS.map(userToRow), { onConflict: 'id', ignoreDuplicates: true });
      if (usersErr) throw usersErr;

      const { error: invErr } = await supabase
        .from('inventory_items')
        .upsert(INITIAL_INVENTORY.map(inventoryToRow), { onConflict: 'id', ignoreDuplicates: true });
      if (invErr) throw invErr;

      const { error: donErr } = await supabase
        .from('surplus_donations')
        .upsert(INITIAL_DONATIONS.map(donationToRow), { onConflict: 'id', ignoreDuplicates: true });
      if (donErr) throw donErr;

      const { error: notifErr } = await supabase
        .from('notifications')
        .upsert(INITIAL_NOTIFICATIONS.map(notificationToRow), { onConflict: 'id', ignoreDuplicates: true });
      if (notifErr) throw notifErr;

      console.log('Initial demo data seeded to Supabase.');
    }
  })();

  try {
    await seedPromise;
  } finally {
    seedPromise = null;
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const supabase = createSupabaseAdminClient();

  if (supabaseConfigError) {
    console.warn('Supabase notice:', supabaseConfigError);
  } else {
    console.log('Supabase client connected.');
  }

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/platform', async (_req, res) => {
    if (!supabase) {
      res.status(500).json({
        error:
          supabaseConfigError ||
          'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env',
      });
      return;
    }

    try {
      await seedDatabaseIfEmpty(supabase);

      const [usersRes, invRes, donRes, notifRes] = await Promise.all([
        supabase.from('users').select('*').order('joined_at', { ascending: false }),
        supabase.from('inventory_items').select('*').order('prepared_at', { ascending: false }),
        supabase.from('surplus_donations').select('*').order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').order('timestamp', { ascending: false }),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (invRes.error) throw invRes.error;
      if (donRes.error) throw donRes.error;
      if (notifRes.error) throw notifRes.error;

      res.json({
        users: (usersRes.data ?? []).map(rowToUser),
        inventory: (invRes.data ?? []).map(rowToInventory),
        donations: (donRes.data ?? []).map(rowToDonation),
        notifications: (notifRes.data ?? []).map(rowToNotification),
      });
    } catch (err: any) {
      console.error('GET /api/platform error:', err);
      res.status(500).json({ error: err?.message || 'Failed to load data from Supabase' });
    }
  });

  app.post('/api/users/register', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { user, notification } = req.body as {
        user: UserAccount;
        notification?: AppNotification;
      };
      const { error } = await supabase.from('users').insert(userToRow(user));
      if (error) throw error;

      if (notification) {
        const { error: notifErr } = await supabase
          .from('notifications')
          .insert(notificationToRow(notification));
        if (notifErr) throw notifErr;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('POST /api/users/register error:', err);
      res.status(500).json({ error: err?.message || 'Failed to register user' });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { id } = req.params;
      const { user, notification } = req.body as {
        user: UserAccount;
        notification?: AppNotification;
      };
      const { error } = await supabase
        .from('users')
        .upsert({ ...userToRow(user), id }, { onConflict: 'id' });
      if (error) throw error;

      if (notification) {
        const { error: notifErr } = await supabase
          .from('notifications')
          .insert(notificationToRow(notification));
        if (notifErr) throw notifErr;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('PATCH /api/users/:id error:', err);
      res.status(500).json({ error: err?.message || 'Failed to update user' });
    }
  });

  app.post('/api/inventory', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { item } = req.body as { item: InventoryItem };
      const { error } = await supabase.from('inventory_items').insert(inventoryToRow(item));
      if (error) throw error;
      res.json({ ok: true });
    } catch (err: any) {
      console.error('POST /api/inventory error:', err);
      res.status(500).json({ error: err?.message || 'Failed to save inventory item' });
    }
  });

  app.delete('/api/inventory/:id', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (err: any) {
      console.error('DELETE /api/inventory/:id error:', err);
      res.status(500).json({ error: err?.message || 'Failed to delete inventory item' });
    }
  });

  app.post('/api/donations', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { donation, notification } = req.body as {
        donation: SurplusDonation;
        notification?: AppNotification;
      };
      const { error } = await supabase
        .from('surplus_donations')
        .insert(donationToRow(donation));
      if (error) throw error;

      if (notification) {
        const { error: notifErr } = await supabase
          .from('notifications')
          .insert(notificationToRow(notification));
        if (notifErr) throw notifErr;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('POST /api/donations error:', err);
      res.status(500).json({ error: err?.message || 'Failed to save donation' });
    }
  });

  app.patch('/api/donations/:id', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { id } = req.params;
      const { donation, notification } = req.body as {
        donation: SurplusDonation;
        notification?: AppNotification;
      };
      const { error } = await supabase
        .from('surplus_donations')
        .upsert({ ...donationToRow(donation), id }, { onConflict: 'id' });
      if (error) throw error;

      if (notification) {
        const { error: notifErr } = await supabase
          .from('notifications')
          .insert(notificationToRow(notification));
        if (notifErr) throw notifErr;
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('PATCH /api/donations/:id error:', err);
      res.status(500).json({ error: err?.message || 'Failed to update donation' });
    }
  });

  app.patch('/api/notifications/read-all', async (_req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw error;
      res.json({ ok: true });
    } catch (err: any) {
      console.error('PATCH /api/notifications/read-all error:', err);
      res.status(500).json({ error: err?.message || 'Failed to update notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', async (req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (err: any) {
      console.error('PATCH /api/notifications/:id/read error:', err);
      res.status(500).json({ error: err?.message || 'Failed to update notification' });
    }
  });

  app.post('/api/reset-demo', async (_req, res) => {
    if (!supabase) {
      res.status(500).json({ error: supabaseConfigError || 'Supabase is not configured in .env' });
      return;
    }
    try {
      await supabase.from('notifications').delete().neq('id', '');
      await supabase.from('surplus_donations').delete().neq('id', '');
      await supabase.from('inventory_items').delete().neq('id', '');
      await supabase.from('users').delete().neq('id', '');

      await supabase.from('users').insert(INITIAL_USERS.map(userToRow));
      await supabase.from('inventory_items').insert(INITIAL_INVENTORY.map(inventoryToRow));
      await supabase.from('surplus_donations').insert(INITIAL_DONATIONS.map(donationToRow));
      await supabase.from('notifications').insert(INITIAL_NOTIFICATIONS.map(notificationToRow));

      res.json({ ok: true });
    } catch (err: any) {
      console.error('POST /api/reset-demo error:', err);
      res.status(500).json({ error: err?.message || 'Failed to reset demo data' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY அமைக்கப்படவில்லை. .env கோப்பில் உங்கள் API விசையைச் சரிபார்க்கவும்.',
      });
      return;
    }

    const body = req.body as {
      message?: unknown;
      history?: unknown;
      context?: PlatformChatContext;
    };

    const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!userMessage) {
      res.status(400).json({ error: 'செய்தி காலியாக இருக்கக் கூடாது.' });
      return;
    }

    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const safeHistory: ChatHistoryTurn[] = rawHistory
      .filter(
        (item): item is ChatHistoryTurn =>
          Boolean(item) &&
          typeof item === 'object' &&
          (item.role === 'user' || item.role === 'model') &&
          typeof item.text === 'string' &&
          item.text.trim().length > 0
      )
      .slice(-12);

    const ctx = body?.context;
    const contextSummary = ctx
      ? `\n\nநேரடித் தள நிலை (Live Platform Snapshot):\n` +
        `- தற்போதைய பயனர்: ${ctx.userName ?? 'விருந்தினர்'} (${ctx.userRole ?? 'public'}, ${ctx.organization ?? 'Unavagam'})\n` +
        `- மொத்த மீட்கப்பட்ட உணவு: ${ctx.totalSavedKg ?? 0} kg (~${ctx.totalMeals ?? 0} உணவுப் பொட்டலங்கள்)\n` +
        `- தற்போது NGO கோரிக்கைக்குக் கிடைக்கும் உபரி உணவுகள் (${ctx.publishedListings?.length ?? 0}): ${
          ctx.publishedListings && ctx.publishedListings.length > 0
            ? ctx.publishedListings
                .map(
                  (d) =>
                    `${d.foodTitle} (${d.quantityKg} kg, ${d.donorOrg} - ${d.neighborhood}, ${d.storageCondition} ${d.temperatureC}°C)`
                )
                .join(' | ')
            : 'தற்போது வெளியிடப்பட்ட உபரி உணவுகள் இல்லை'
        }\n` +
        `- சரிபார்க்கப்பட்ட NGO-கள் (${ctx.verifiedNgos?.length ?? 0}): ${
          ctx.verifiedNgos && ctx.verifiedNgos.length > 0
            ? ctx.verifiedNgos
                .map(
                  (n) =>
                    `${n.organization} (${n.neighborhood}, திறன் ${n.capacityKg ?? 100} kg/நாள்)`
                )
                .join(' | ')
            : 'தகவல் இல்லை'
        }`
      : '';

    try {
      const contents = [
        ...safeHistory.map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        {
          role: 'user' as const,
          parts: [{ text: userMessage }],
        },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: `${SYSTEM_INSTRUCTION}${contextSummary}`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({
          error: 'AI மாதிரியிலிருந்து பதில் பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      const status = typeof errObj?.status === 'number' ? errObj.status : 500;
      const msg =
        errObj?.message ||
        'AI சேவையைத் தொடர்பு கொள்ளும்போது பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.';
      console.error('Gemini /api/chat error:', err);
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/voice/transcribe', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY அமைக்கப்படவில்லை. .env கோப்பில் உங்கள் API விசையைச் சரிபார்க்கவும்.',
      });
      return;
    }

    const body = req.body as {
      audioBase64?: unknown;
      mimeType?: unknown;
    };

    const audioBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const rawMime = typeof body?.mimeType === 'string' ? body.mimeType.trim() : 'audio/webm';
    const mimeType = rawMime.split(';')[0] || 'audio/webm';

    if (!audioBase64) {
      res.status(400).json({ error: 'குரல் பதிவுத் தரவு கிடைக்கவில்லை.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken audio accurately. If spoken in Tamil, write natural Tamil script; if spoken in English or mixed Tamil-English, transcribe accurately.',
            },
          ],
        },
      });

      const transcript = response.text?.trim() ?? '';
      if (!transcript) {
        res.status(422).json({
          error: 'பேச்சு தெளிவாகப் பதிவாகவில்லை. மீண்டும் அருகில் பேசி முயற்சிக்கவும்.',
        });
        return;
      }

      res.json({ transcript });
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      const status = typeof errObj?.status === 'number' ? errObj.status : 500;
      const msg =
        errObj?.message ||
        'குரலை எழுத்தாக மாற்றும்போது பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.';
      console.error('Gemini /api/voice/transcribe error:', err);
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/voice/speak', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY அமைக்கப்படவில்லை. .env கோப்பில் உங்கள் API விசையைச் சரிபார்க்கவும்.',
      });
      return;
    }

    const body = req.body as {
      text?: unknown;
      voiceName?: unknown;
    };

    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'வாசிக்க வேண்டிய உரை காலியாக உள்ளது.' });
      return;
    }

    const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
    const requestedVoice = typeof body?.voiceName === 'string' ? body.voiceName : 'Kore';
    const voiceName = (allowedVoices as readonly string[]).includes(requestedVoice)
      ? requestedVoice
      : 'Kore';

    const cleanText = text.replace(/[*_`#>-]+/g, ' ').replace(/\s+/g, ' ').trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: 'Warm, clear, friendly Tamil customer assistance voice',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: 'குரல் ஒலியை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      const status = typeof errObj?.status === 'number' ? errObj.status : 500;
      const msg =
        errObj?.message ||
        'குரல் வெளியீட்டை உருவாக்கும்போது பிழை ஏற்பட்டது.';
      console.error('Gemini /api/voice/speak error:', err);
      res.status(status).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Unavagam server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});