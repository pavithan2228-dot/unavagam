import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_AVATARS } from '../../data/seedData';
import { usePlatform } from '../../context/PlatformContext';
import { METRO_NEIGHBORHOOD_PRESETS } from '../../services/forecastingService';
import { formatDateTimeShort } from '../../utils/formatters';
import { MapMarkerItem, RouteMap } from './RouteMap';

function cropImageToSquareDataUrl(source: HTMLImageElement | HTMLVideoElement): string {
  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const srcWidth =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth || source.width;
  const srcHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight || source.height;

  const side = Math.min(srcWidth, srcHeight);
  const sx = Math.max(0, (srcWidth - side) / 2);
  const sy = Math.max(0, (srcHeight - side) / 2);

  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export const ProfileView: React.FC = () => {
  const { currentUser, donations, updateCurrentUserProfile, pushToast } = usePlatform();

  const [name, setName] = useState(currentUser?.name ?? '');
  const [organization, setOrganization] = useState(currentUser?.organization ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [organizationCategory, setOrganizationCategory] = useState(
    currentUser?.organizationCategory ?? ''
  );
  const [licenseOrRegId, setLicenseOrRegId] = useState(currentUser?.licenseOrRegId ?? '');
  const [neighborhood, setNeighborhood] = useState(currentUser?.location.neighborhood ?? '');
  const [address, setAddress] = useState(currentUser?.location.address ?? '');
  const [hubLat, setHubLat] = useState<number>(currentUser?.location.lat ?? 12.9719);
  const [hubLng, setHubLng] = useState<number>(currentUser?.location.lng ?? 77.6412);
  const [capacityKg, setCapacityKg] = useState(String(currentUser?.capacityKg ?? 100));
  const [vehicleType, setVehicleType] = useState(currentUser?.vehicleType ?? '');
  const [maxPayloadKg, setMaxPayloadKg] = useState(String(currentUser?.maxPayloadKg ?? 150));
  const [serviceZone, setServiceZone] = useState(currentUser?.serviceZone ?? '');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setName(currentUser.name);
    setOrganization(currentUser.organization);
    setPhone(currentUser.phone);
    setOrganizationCategory(currentUser.organizationCategory ?? '');
    setLicenseOrRegId(currentUser.licenseOrRegId ?? '');
    setNeighborhood(currentUser.location.neighborhood);
    setAddress(currentUser.location.address);
    setHubLat(currentUser.location.lat);
    setHubLng(currentUser.location.lng);
    setCapacityKg(String(currentUser.capacityKg ?? 100));
    setVehicleType(currentUser.vehicleType ?? '');
    setMaxPayloadKg(String(currentUser.maxPayloadKg ?? 150));
    setServiceZone(currentUser.serviceZone ?? '');
  }, [currentUser]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (!currentUser) return null;

  const roleTitle =
    currentUser.role === 'volunteer'
      ? 'Shipper / Cold-Chain Courier'
      : currentUser.role === 'ngo'
        ? 'NGO / Charity Partner'
        : currentUser.role === 'donor'
          ? 'Food Donor Kitchen'
          : 'Platform Administrator';

  const identityCode = `UNV-${currentUser.id.toUpperCase()}`;

  const partnerStats = useMemo(() => {
    if (currentUser.role === 'donor') {
      const myDonations = donations.filter((d) => d.donorId === currentUser.id);
      const totalKg = myDonations.reduce((acc, d) => acc + d.confirmedQuantityKg, 0);
      return {
        primaryLabel: 'Donations Published',
        primaryValue: String(myDonations.length),
        secondaryLabel: 'Surplus Contributed',
        secondaryValue: `${totalKg.toFixed(1)} kg`,
      };
    }
    if (currentUser.role === 'ngo') {
      const claimed = donations.filter((d) => d.claimedByNgoId === currentUser.id);
      const receivedKg = claimed
        .filter((d) => d.status === 'delivered')
        .reduce((acc, d) => acc + d.confirmedQuantityKg, 0);
      return {
        primaryLabel: 'Batches Claimed',
        primaryValue: String(claimed.length),
        secondaryLabel: 'Food Received',
        secondaryValue: `${receivedKg.toFixed(1)} kg`,
      };
    }
    if (currentUser.role === 'volunteer') {
      const runs = donations.filter((d) => d.assignedVolunteerId === currentUser.id);
      const deliveredKg = runs
        .filter((d) => d.status === 'delivered')
        .reduce((acc, d) => acc + d.confirmedQuantityKg, 0);
      return {
        primaryLabel: 'Assigned Dispatches',
        primaryValue: String(runs.length),
        secondaryLabel: 'Payload Delivered',
        secondaryValue: `${deliveredKg.toFixed(1)} kg`,
      };
    }
    return {
      primaryLabel: 'Platform Rescues',
      primaryValue: String(donations.length),
      secondaryLabel: 'Verified Ops',
      secondaryValue: 'Active',
    };
  }, [currentUser.id, currentUser.role, donations]);

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Invalid File', 'Please select a PNG, JPG, or WebP image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const dataUrl = cropImageToSquareDataUrl(img);
        if (dataUrl) {
          updateCurrentUserProfile({ avatarUrl: dataUrl });
        }
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera is unavailable in this browser. Use Upload Photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
            videoRef.current?.play().catch(() => {});
          };
        }
      });
    } catch {
      setCameraError(
        'Camera access denied or unavailable. Please allow camera permission or upload an image file.'
      );
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !cameraReady) return;
    const dataUrl = cropImageToSquareDataUrl(videoRef.current);
    stopCamera();
    if (dataUrl) {
      updateCurrentUserProfile({ avatarUrl: dataUrl });
    }
  };

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organization.trim()) {
      pushToast('Missing Fields', 'Full name and organization/fleet name are required.', 'error');
      return;
    }
    updateCurrentUserProfile({
      name: name.trim(),
      organization: organization.trim(),
      phone: phone.trim(),
      organizationCategory: organizationCategory.trim() || undefined,
      licenseOrRegId: licenseOrRegId.trim() || undefined,
      capacityKg: currentUser.role === 'ngo' ? Number(capacityKg) || 100 : currentUser.capacityKg,
      vehicleType:
        currentUser.role === 'volunteer' ? vehicleType.trim() || currentUser.vehicleType : undefined,
      maxPayloadKg:
        currentUser.role === 'volunteer' ? Number(maxPayloadKg) || 150 : currentUser.maxPayloadKg,
      serviceZone:
        currentUser.role === 'volunteer' ? serviceZone.trim() || undefined : currentUser.serviceZone,
      location: {
        lat: hubLat,
        lng: hubLng,
        neighborhood: neighborhood.trim() || currentUser.location.neighborhood,
        address: address.trim() || currentUser.location.address,
      },
    });
  };

  const hubMapMarkers: MapMarkerItem[] = [
    {
      id: 'profile-hub-pin',
      label: organization || currentUser.organization,
      sublabel: `${roleTitle} · ${hubLat.toFixed(4)}, ${hubLng.toFixed(4)}`,
      badgeText:
        currentUser.role === 'donor' ? 'P' : currentUser.role === 'ngo' ? 'D' : 'S',
      type: currentUser.role === 'admin' ? 'ngo' : currentUser.role,
      point: {
        lat: hubLat,
        lng: hubLng,
        neighborhood: neighborhood || currentUser.location.neighborhood,
        address: address || currentUser.location.address,
      },
      selected: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-on-surface">
            Profile &amp; Partner Identity
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Capture or upload your profile photo and inspect your verified Unavagam identity badge.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold self-start sm:self-auto ${
            currentUser.verificationStatus === 'verified'
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-tertiary-fixed text-on-tertiary-fixed'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {currentUser.verificationStatus === 'verified' ? 'verified' : 'hourglass_top'}
          </span>
          <span className="uppercase">{currentUser.verificationStatus} Partner</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Digital Partner Identity Card + Get Photo Controls */}
        <div className="lg:col-span-5 space-y-4">
          <section
            aria-label="Partner Identity Card"
            className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(11,28,48,0.06)]"
          >
            {/* Card Header Strip */}
            <div className="bg-primary text-on-primary px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-primary/80">
                  Unavagam Official Partner ID
                </p>
                <p className="text-sm font-display font-bold truncate">{roleTitle}</p>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-white/15 shrink-0">
                {identityCode}
              </span>
            </div>

            {/* Avatar Photo + Identity Summary */}
            <div className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center sm:items-start lg:items-center xl:items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-28 h-28 rounded-2xl object-cover shadow-md ring-2 ring-secondary-container"
                  />
                  <span
                    title={`Status: ${currentUser.verificationStatus}`}
                    className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                      currentUser.verificationStatus === 'verified'
                        ? 'bg-primary text-on-primary'
                        : 'bg-tertiary text-on-tertiary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {currentUser.verificationStatus === 'verified' ? 'verified_user' : 'schedule'}
                    </span>
                  </span>
                </div>

                <div className="min-w-0 text-center sm:text-left lg:text-center xl:text-left space-y-1">
                  <h2 className="text-lg font-display font-bold text-on-surface truncate">
                    {currentUser.name}
                  </h2>
                  <p className="text-xs font-bold text-primary truncate">
                    {currentUser.organization}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">{currentUser.email}</p>
                  <p className="text-[11px] text-outline font-mono">{currentUser.phone}</p>
                </div>
              </div>

              {/* Get Photo Controls */}
              <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
                  Update Profile Photo
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    <span>Upload Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={cameraOpen ? stopCamera : openCamera}
                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest hover:bg-secondary-container text-on-surface text-xs font-bold shadow-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>{cameraOpen ? 'Close Camera' : 'Take Photo'}</span>
                  </button>
                  {currentUser.avatarUrl !== DEMO_AVATARS[currentUser.role] && (
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentUserProfile({ avatarUrl: DEMO_AVATARS[currentUser.role] })
                      }
                      title="Restore Default Avatar"
                      className="inline-flex items-center justify-center px-2.5 py-2 rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-error text-xs font-bold shadow-sm transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    </button>
                  )}
                </div>

                {cameraError && (
                  <p className="text-[11px] text-error font-medium bg-error-container/60 px-3 py-2 rounded-lg">
                    {cameraError}
                  </p>
                )}

                {cameraOpen && (
                  <div className="space-y-2.5 pt-1">
                    <div className="relative rounded-xl overflow-hidden bg-inverse-surface aspect-square max-h-60 mx-auto flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={captureFromCamera}
                        disabled={!cameraReady}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">camera</span>
                        <span>Capture &amp; Save Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 rounded-xl bg-surface-container-lowest text-xs font-bold text-on-surface-variant"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Structured Identity Ledger */}
              <div className="divide-y divide-surface-container text-xs">
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">Identity Code</span>
                  <span className="font-mono font-bold text-on-surface">{identityCode}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">
                    {currentUser.role === 'donor'
                      ? 'FSSAI / License ID'
                      : currentUser.role === 'ngo'
                        ? 'NGO / 80G Reg ID'
                        : currentUser.role === 'volunteer'
                          ? 'Driver / Fleet ID'
                          : 'Authority ID'}
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {currentUser.licenseOrRegId || 'Pending Entry'}
                  </span>
                </div>
                {currentUser.organizationCategory && (
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-on-surface-variant">Category</span>
                    <span className="font-semibold text-on-surface text-right">
                      {currentUser.organizationCategory}
                    </span>
                  </div>
                )}
                {currentUser.role === 'ngo' && (
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-on-surface-variant">Daily Capacity</span>
                    <span className="font-mono font-bold text-on-surface">
                      {currentUser.capacityKg ?? 100} kg / day
                    </span>
                  </div>
                )}
                {currentUser.role === 'volunteer' && (
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-on-surface-variant">Fleet / Vehicle</span>
                    <span className="font-semibold text-on-surface text-right">
                      {currentUser.vehicleType ?? 'Cold-Chain Van'}
                    </span>
                  </div>
                )}
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">Hub Location</span>
                  <span className="font-semibold text-on-surface text-right">
                    {currentUser.location.neighborhood} · {currentUser.location.address}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">Registered On</span>
                  <span className="font-mono text-on-surface">
                    {formatDateTimeShort(currentUser.joinedAt)}
                  </span>
                </div>
              </div>

              {/* Partner Activity Counters */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-surface-container-low">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-outline">
                    {partnerStats.primaryLabel}
                  </p>
                  <p className="text-lg font-display font-bold font-mono text-on-surface mt-0.5">
                    {partnerStats.primaryValue}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-outline">
                    {partnerStats.secondaryLabel}
                  </p>
                  <p className="text-lg font-display font-bold font-mono text-primary mt-0.5">
                    {partnerStats.secondaryValue}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Editable Profile & Credential Settings */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="pb-4 mb-5 border-b border-surface-container">
            <h2 className="text-base font-display font-bold text-on-surface">
              Edit Profile &amp; Identity Credentials
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Changes reflect immediately across Unavagam matching, NGO profiles, and dispatch manifests.
            </p>
          </div>

          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  Organization / Fleet Name
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  {currentUser.role === 'donor'
                    ? 'FSSAI / Kitchen Hygiene License ID'
                    : currentUser.role === 'ngo'
                      ? 'NGO / 80G Registration ID'
                      : currentUser.role === 'volunteer'
                        ? 'Driver / Fleet License ID'
                        : 'Platform Authority ID'}
                </label>
                <input
                  type="text"
                  value={licenseOrRegId}
                  onChange={(e) => setLicenseOrRegId(e.target.value)}
                  placeholder="Enter license or registration number"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  Category / Operations Focus
                </label>
                <input
                  type="text"
                  value={organizationCategory}
                  onChange={(e) => setOrganizationCategory(e.target.value)}
                  placeholder="e.g. Hotel Kitchen / Community Pantry"
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  Neighborhood
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Interactive Hub Map Pin */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-on-surface">
                  Hub Coordinates on OpenStreetMap
                </label>
                <span className="text-[11px] font-mono font-semibold text-primary">
                  {hubLat.toFixed(4)}, {hubLng.toFixed(4)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {METRO_NEIGHBORHOOD_PRESETS.slice(0, 6).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setNeighborhood(preset.name);
                      setHubLat(preset.lat);
                      setHubLng(preset.lng);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      neighborhood.toLowerCase() === preset.name.toLowerCase()
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <RouteMap
                markers={hubMapMarkers}
                heightClass="h-52"
                hideLegend
                showGpsButton
                onPickLocation={(lat, lng) => {
                  setHubLat(lat);
                  setHubLng(lng);
                }}
              />
            </div>

            {currentUser.role === 'ngo' && (
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  Daily Storage &amp; Receiving Capacity (kg)
                </label>
                <input
                  type="number"
                  min={10}
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {currentUser.role === 'volunteer' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">
                    Vehicle Type
                  </label>
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">
                    Max Payload (kg)
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={maxPayloadKg}
                    onChange={(e) => setMaxPayloadKg(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">
                    Service Zone
                  </label>
                  <input
                    type="text"
                    value={serviceZone}
                    onChange={(e) => setServiceZone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>Save Profile &amp; Identity</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
