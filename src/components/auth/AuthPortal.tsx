import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { METRO_NEIGHBORHOOD_PRESETS } from '../../services/forecastingService';
import { UserRole } from '../../types/platform';
import { BrandMark } from '../shared/BrandMark';
import { MapMarkerItem, RouteMap } from '../shared/RouteMap';

type PartnerRegistrationRole = 'donor' | 'ngo' | 'volunteer';

const PARTNER_TRACKS: Array<{
  role: PartnerRegistrationRole;
  title: string;
  tagline: string;
  subtitle: string;
  icon: string;
  highlights: string[];
}> = [
  {
    role: 'donor',
    title: 'Food Donor',
    tagline: 'Kitchens & Catering',
    subtitle: 'Hotels, restaurants, college hostels & banquet halls',
    icon: 'storefront',
    highlights: ['AI surplus forecasting', 'Food safety checklist gate', 'Live collection tracking'],
  },
  {
    role: 'ngo',
    title: 'NGO / Charity',
    tagline: 'Food Relief Hubs',
    subtitle: 'Community pantries, shelters & charitable trusts',
    icon: 'volunteer_activism',
    highlights: ['Nearby surplus radar', 'Verified cold-chain logs', 'One-tap batch claiming'],
  },
  {
    role: 'volunteer',
    title: 'Shippers',
    tagline: 'Cold-Chain Fleet',
    subtitle: 'Insulated vans, cargo riders & volunteer shippers',
    icon: 'local_shipping',
    highlights: ['Multi-stop Leaflet routing', 'Pickup temperature checks', 'Delivery chain history'],
  },
];

export const AuthPortal: React.FC<{
  onLaunchPublic?: () => void;
  onAuthenticated?: (role: UserRole) => void;
}> = ({ onLaunchPublic, onAuthenticated }) => {
  const { loginAsRole, loginWithEmail, registerOrganization, users } = usePlatform();
  const [mode, setMode] = useState<'register' | 'signin'>('register');
  const [email, setEmail] = useState('rajesh@grandregency.org');

  const [regRole, setRegRole] = useState<PartnerRegistrationRole>('donor');
  const [regName, setRegName] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('Indiranagar');
  const [regAddress, setRegAddress] = useState('');
  const [regCategory, setRegCategory] = useState('Hotel / Banquet Kitchen');
  const [regLicenseId, setRegLicenseId] = useState('');
  const [regCapacity, setRegCapacity] = useState('120');
  const [regVehicle, setRegVehicle] = useState('Insulated E-Van');
  const [regPayloadKg, setRegPayloadKg] = useState('150');
  const [regServiceZone, setRegServiceZone] = useState('Central & East Zone');
  const [regAvatarUrl, setRegAvatarUrl] = useState<string>('');
  const [regLat, setRegLat] = useState<number>(12.9719);
  const [regLng, setRegLng] = useState<number>(77.6412);
  const [formError, setFormError] = useState('');

  const pickerMarkers: MapMarkerItem[] = useMemo(
    () => [
      {
        id: 'reg-pin',
        label: regOrg.trim() || `${regRole === 'volunteer' ? 'Shipper' : regRole.toUpperCase()} Hub Pin`,
        sublabel: `${regNeighborhood || 'Selected Zone'} · ${regLat.toFixed(4)}, ${regLng.toFixed(4)}`,
        badgeText: regRole === 'donor' ? 'P' : regRole === 'ngo' ? 'D' : 'S',
        type: regRole,
        point: {
          lat: regLat,
          lng: regLng,
          address: regAddress.trim() || `${regNeighborhood || 'Indiranagar'} Pin`,
          neighborhood: regNeighborhood || 'Indiranagar',
        },
        selected: true,
      },
    ],
    [regOrg, regRole, regNeighborhood, regLat, regLng, regAddress]
  );

  const handleRegPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const sx = Math.max(0, ((img.naturalWidth || img.width) - side) / 2);
        const sy = Math.max(0, ((img.naturalHeight || img.height) - side) / 2);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        setRegAvatarUrl(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  };

  const handleSelectTrack = (nextRole: PartnerRegistrationRole) => {
    setRegRole(nextRole);
    setFormError('');
    if (nextRole === 'donor') {
      setRegCategory('Hotel / Banquet Kitchen');
    } else if (nextRole === 'ngo') {
      setRegCategory('Community Pantry / Shelter');
    } else {
      setRegCategory('Dedicated Cold-Chain Shipper');
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim()) {
      setFormError('Please enter your registered account email.');
      return;
    }
    const matched = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    const ok = loginWithEmail(email);
    if (!ok) {
      setFormError(
        'No registered account found for that email. Register as a Donor, NGO, or Shipper first.'
      );
      return;
    }
    if (matched && onAuthenticated) {
      onAuthenticated(matched.role);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!regName.trim() || !regOrg.trim() || !regEmail.trim() || !regAddress.trim()) {
      setFormError('Full name, organization/fleet name, email, and street address are required.');
      return;
    }
    if (!regEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === regEmail.trim().toLowerCase())) {
      setFormError('An account with this email is already registered. Use Sign In instead.');
      return;
    }
    const created = registerOrganization({
      name: regName,
      email: regEmail,
      role: regRole,
      organization: regOrg,
      phone: regPhone,
      neighborhood: regNeighborhood,
      address: regAddress,
      organizationCategory: regCategory,
      licenseOrRegId: regLicenseId || undefined,
      capacityKg: regRole === 'ngo' ? Number(regCapacity) || 100 : undefined,
      vehicleType:
        regRole === 'volunteer'
          ? `${regVehicle} (${Number(regPayloadKg) || 100} kg)`
          : undefined,
      maxPayloadKg: regRole === 'volunteer' ? Number(regPayloadKg) || 100 : undefined,
      serviceZone: regRole === 'volunteer' ? regServiceZone : undefined,
      avatarUrl: regAvatarUrl || undefined,
      lat: regLat,
      lng: regLng,
    });
    if (onAuthenticated) {
      onAuthenticated(created.role);
    }
  };

  const selectedTrack = PARTNER_TRACKS.find((t) => t.role === regRole) ?? PARTNER_TRACKS[0];

  const submitLabel =
    regRole === 'donor'
      ? 'Register Food Donor Account'
      : regRole === 'ngo'
        ? 'Register NGO Partner Account'
        : 'Register Shipper Account';

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-between">
      <header className="bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-4 sm:px-8 h-16 flex items-center sticky top-0 z-30">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <BrandMark />
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg tracking-tight text-on-surface">
                Unavagam
              </span>
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-primary">
                Partner Registration
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onLaunchPublic && (
              <button
                type="button"
                onClick={onLaunchPublic}
                className="px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-colors whitespace-nowrap"
              >
                Public Directory
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'register' : 'signin');
                setFormError('');
              }}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition-colors whitespace-nowrap"
            >
              {mode === 'signin' ? 'New Registration' : 'Partner Sign In'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8 lg:py-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Context & Selected Partner Role Overview */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                Dedicated Role Onboarding · Unavagam
              </span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-display font-bold text-on-surface tracking-tight leading-tight text-balance">
              Register as a{' '}
              <span className="text-primary">Donor, NGO, or Shipper</span>
            </h1>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              Every organization enters its own dedicated Unavagam workspace after onboarding —
              keeping donor kitchens, verified NGOs, and cold-chain shippers cleanly separated while
              connected on live deliveries.
            </p>

            {/* Active Track Summary Card */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-container text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    {selectedTrack.icon}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    {selectedTrack.tagline}
                  </p>
                  <h2 className="text-sm font-bold text-on-surface">
                    {selectedTrack.title} Workspace
                  </h2>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {selectedTrack.subtitle}
              </p>
              <div className="space-y-2 pt-1">
                {selectedTrack.highlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                      check_circle
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-on-surface">Platform Verifications</p>
                <p className="text-[11px] text-on-surface-variant">
                  Admin console audits all newly registered Donors, NGOs &amp; Shippers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  loginAsRole('admin');
                  if (onAuthenticated) onAuthenticated('admin');
                }}
                className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-primary text-[11px] font-bold shadow-sm hover:bg-secondary-container transition-colors shrink-0"
              >
                Admin Sign In
              </button>
            </div>
          </div>

          {/* Right Panel: Dedicated Registration / Sign In */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 lg:p-8 shadow-[0_2px_16px_rgba(11,28,48,0.05)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-surface-container">
              <div>
                <h2 className="text-lg font-display font-bold text-on-surface">
                  {mode === 'register' ? 'Partner Registration' : 'Sign In to Your Portal'}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {mode === 'register'
                    ? 'Choose your role below and submit credentials to open your dedicated portal.'
                    : 'Enter your registered organization or shipper email to access your workspace.'}
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl shrink-0">
                {(
                  [
                    { id: 'register', label: 'Register' },
                    { id: 'signin', label: 'Sign In' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setMode(t.id);
                      setFormError('');
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      mode === t.id
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                {formError && (
                  <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                    {formError}
                  </div>
                )}

                {/* Step 1: 3-Way Profession Selector (Donor / NGO / Shippers) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-outline">
                    1. Select Registration Role
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {PARTNER_TRACKS.map((track) => {
                      const active = regRole === track.role;
                      return (
                        <button
                          key={track.role}
                          type="button"
                          onClick={() => handleSelectTrack(track.role)}
                          className={`p-3.5 rounded-xl text-left transition-all border ${
                            active
                              ? 'bg-secondary-container/45 border-primary shadow-sm'
                              : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`material-symbols-outlined text-[20px] ${
                                active ? 'text-primary' : 'text-on-surface-variant'
                              }`}
                            >
                              {track.icon}
                            </span>
                            {active && (
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                check_circle
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-on-surface">{track.title}</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                            {track.tagline}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Role-Specific Profile & Credentials */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-outline">
                      2. {selectedTrack.title} Details
                    </label>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-bold text-primary cursor-pointer transition-colors">
                      {regAvatarUrl ? (
                        <img
                          src={regAvatarUrl}
                          alt="Uploaded preview"
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                      )}
                      <span>{regAvatarUrl ? 'Change Photo' : 'Add Profile Photo (Optional)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleRegPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        {regRole === 'volunteer' ? 'Shipper / Driver Full Name' : 'Contact Full Name'}
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder={
                          regRole === 'volunteer' ? 'e.g. Karthik Subramanian' : 'e.g. Siddharth Rao'
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        {regRole === 'donor'
                          ? 'Kitchen / Organization Name'
                          : regRole === 'ngo'
                            ? 'NGO / Trust Name'
                            : 'Fleet / Shipper Company Name'}
                      </label>
                      <input
                        type="text"
                        value={regOrg}
                        onChange={(e) => setRegOrg(e.target.value)}
                        placeholder={
                          regRole === 'donor'
                            ? 'e.g. Green Leaf Hostel Mess'
                            : regRole === 'ngo'
                              ? 'e.g. Karuna Food Relief Trust'
                              : 'e.g. Metro Cold-Chain Express'
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        Work Email Address
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="contact@organization.in"
                        className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        Mobile / Dispatch Phone
                      </label>
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 98450 00000"
                        className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Role-specific row */}
                  {regRole === 'donor' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          Donor Facility Type
                        </label>
                        <select
                          value={regCategory}
                          onChange={(e) => setRegCategory(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Hotel / Banquet Kitchen">Hotel / Banquet Kitchen</option>
                          <option value="Restaurant / Cloud Kitchen">Restaurant / Cloud Kitchen</option>
                          <option value="College / Hostel Mess">College / Hostel Mess</option>
                          <option value="Corporate Cafeteria / Caterer">Corporate Cafeteria / Caterer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          FSSAI / Hygiene License No.
                        </label>
                        <input
                          type="text"
                          value={regLicenseId}
                          onChange={(e) => setRegLicenseId(e.target.value)}
                          placeholder="e.g. FSSAI-1122334455"
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}

                  {regRole === 'ngo' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          NGO Focus
                        </label>
                        <select
                          value={regCategory}
                          onChange={(e) => setRegCategory(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Community Pantry / Shelter">Community Pantry</option>
                          <option value="Orphanage & Youth Care">Orphanage / Youth Care</option>
                          <option value="City Food Bank Hub">City Food Bank Hub</option>
                          <option value="Elderly Relief Kitchen">Elderly Relief Kitchen</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          NGO / 80G Reg ID
                        </label>
                        <input
                          type="text"
                          value={regLicenseId}
                          onChange={(e) => setRegLicenseId(e.target.value)}
                          placeholder="e.g. NGO-TN-80G-412"
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          Daily Capacity (kg)
                        </label>
                        <input
                          type="number"
                          min={10}
                          value={regCapacity}
                          onChange={(e) => setRegCapacity(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}

                  {regRole === 'volunteer' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          Shipper Vehicle Type
                        </label>
                        <select
                          value={regVehicle}
                          onChange={(e) => setRegVehicle(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Insulated E-Van">Insulated E-Van</option>
                          <option value="Refrigerated Box Truck">Refrigerated Box Truck</option>
                          <option value="Thermal Cargo Scooter">Thermal Cargo Scooter</option>
                          <option value="Cargo E-Bike">Cargo E-Bike</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          Max Payload (kg)
                        </label>
                        <input
                          type="number"
                          min={10}
                          value={regPayloadKg}
                          onChange={(e) => setRegPayloadKg(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          Driver / Fleet ID
                        </label>
                        <input
                          type="text"
                          value={regLicenseId}
                          onChange={(e) => setRegLicenseId(e.target.value)}
                          placeholder="e.g. KA-03-DL-9981"
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        Neighborhood
                      </label>
                      <input
                        type="text"
                        value={regNeighborhood}
                        onChange={(e) => setRegNeighborhood(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className={regRole === 'volunteer' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        {regRole === 'donor'
                          ? 'Kitchen Pickup Street Address'
                          : regRole === 'ngo'
                            ? 'Drop-off Pantry Address'
                            : 'Dispatch Base Address'}
                      </label>
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="e.g. 100 Feet Road, Indiranagar"
                        className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {regRole === 'volunteer' && (
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          Service Zone
                        </label>
                        <input
                          type="text"
                          value={regServiceZone}
                          onChange={(e) => setRegServiceZone(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>

                  {/* Interactive Pin Location Map */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-on-surface">
                        Pin Hub Location on Map
                      </label>
                      <span className="text-[11px] font-mono text-primary font-semibold">
                        {regLat.toFixed(4)}, {regLng.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {METRO_NEIGHBORHOOD_PRESETS.slice(0, 6).map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setRegNeighborhood(preset.name);
                            setRegLat(preset.lat);
                            setRegLng(preset.lng);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            regNeighborhood.toLowerCase() === preset.name.toLowerCase()
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                    <RouteMap
                      markers={pickerMarkers}
                      heightClass="h-44"
                      hideLegend
                      showGpsButton
                      onPickLocation={(lat, lng) => {
                        setRegLat(lat);
                        setRegLng(lng);
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 text-sm font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
                >
                  {submitLabel}
                </button>
              </form>
            )}

            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.org"
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-on-surface">
                    Registered Partner &amp; Shipper Directory:
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                    {[
                      { email: 'rajesh@grandregency.org', label: 'Donor' },
                      { email: 'ananya@hopehearth.org', label: 'NGO' },
                      { email: 'liam.carter@smartplate.org', label: 'Shipper' },
                      { email: 'elena.admin@smartplate.ai', label: 'Admin' },
                    ].map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => setEmail(acc.email)}
                        className="px-2.5 py-1 rounded-lg bg-surface-container-lowest text-primary font-semibold shadow-sm hover:bg-secondary-container transition-colors"
                      >
                        {acc.label}: {acc.email}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-4 text-sm font-bold text-on-primary bg-primary hover:bg-primary-container rounded-xl shadow-sm transition-colors"
                >
                  Sign In to Assigned Portal
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
