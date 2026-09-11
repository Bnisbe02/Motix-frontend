import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Palette,
  Upload,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useBrandKit, validateBrandAsset } from '../hooks/useBrandKit';
import { useToast } from '../contexts/ToastContext';
import { BrandAssetKind, BrandKit, Daypart, DEFAULT_BRAND_KIT, DEFAULT_DAYPARTS } from '../types/pcr';
import { DaypartValidation, isValidHexColour, isValidTime, validateDayparts } from '../utils/dayparts';

/*
  Brand kit settings page — /app/settings/brand

  Left column: the editable kit (name, colours, fonts, logos, dayparts).
  Right column: a live preview of a title slide and a table slide so the
  user sees the brand before any report is generated.

  Colours / fonts / dayparts are held in local form state and written on
  Save. Logo and cover uploads persist immediately through the hook (the
  storage path has to be saved as soon as the object exists).
*/

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const FONT_OPTIONS: string[] = [
  'Montserrat',
  'Calibri',
  'Arial',
  'Helvetica',
  'Gotham',
  'Proxima Nova',
  'Poppins',
  'Inter',
  'Roboto',
];

const FONT_HELPER_TEXT =
  "PowerPoint uses this font name. If a viewer's machine lacks the font, PowerPoint substitutes a similar one.";

type ColourField = 'primary_colour' | 'secondary_colour' | 'accent_colour' | 'text_on_primary';

interface ColourFieldDef {
  key: ColourField;
  label: string;
  hint: string;
}

const COLOUR_FIELDS: ColourFieldDef[] = [
  { key: 'primary_colour', label: 'Primary', hint: 'Title slide background, table headers' },
  { key: 'secondary_colour', label: 'Secondary', hint: 'Alternating table rows, panels' },
  { key: 'accent_colour', label: 'Accent', hint: 'Rules, highlights, callouts' },
  { key: 'text_on_primary', label: 'Text on primary', hint: 'Text placed over the primary colour' },
];

interface AssetFieldDef {
  kind: BrandAssetKind;
  column: 'logo_light_path' | 'logo_dark_path' | 'cover_image_path';
  label: string;
  hint: string;
}

const ASSET_FIELDS: AssetFieldDef[] = [
  { kind: 'logo_light', column: 'logo_light_path', label: 'Logo (light)', hint: 'Used on dark / primary backgrounds' },
  { kind: 'logo_dark', column: 'logo_dark_path', label: 'Logo (dark)', hint: 'Used on white backgrounds' },
  { kind: 'cover_image', column: 'cover_image_path', label: 'Cover image', hint: 'Optional title slide background (16:9 works best)' },
];

// ------------------------------------------------------------
// Form model
// ------------------------------------------------------------

interface BrandKitForm {
  name: string;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  text_on_primary: string;
  heading_font: string;
  body_font: string;
  dayparts: Daypart[];
  tone_description: string;
  tone_reference: string;
}

function formFromKit(kit: BrandKit | null): BrandKitForm {
  const source = kit ?? DEFAULT_BRAND_KIT;
  return {
    name: source.name,
    primary_colour: source.primary_colour,
    secondary_colour: source.secondary_colour,
    accent_colour: source.accent_colour,
    text_on_primary: source.text_on_primary,
    heading_font: source.heading_font,
    body_font: source.body_font,
    dayparts: (Array.isArray(source.dayparts) ? source.dayparts : DEFAULT_DAYPARTS).map((d) => ({ ...d })),
    tone_description: kit?.tone_description ?? '',
    tone_reference: kit?.tone_reference ?? '',
  };
}

// ------------------------------------------------------------
// Form validation
// ------------------------------------------------------------

function validateForm(form: BrandKitForm): string[] {
  const errors: string[] = [];
  if (form.name.trim() === '') {
    errors.push('Kit name is required.');
  }
  COLOUR_FIELDS.forEach((f) => {
    if (!isValidHexColour(form[f.key])) {
      errors.push(`${f.label} must be a 6-digit hex colour like #5B2C83.`);
    }
  });
  if (form.heading_font.trim() === '') {
    errors.push('Heading font is required.');
  }
  if (form.body_font.trim() === '') {
    errors.push('Body font is required.');
  }
  const dayparts = validateDayparts(form.dayparts);
  errors.push(...Object.values(dayparts.rowErrors).map((m) => `Daypart: ${m}`));
  errors.push(...dayparts.globalErrors.map((m) => `Daypart: ${m}`));
  return errors;
}

/** Tailwind-free helper: returns a hex colour with an alpha suffix (e.g. 20%). */
function withAlpha(hex: string, alphaHex: string): string {
  return isValidHexColour(hex) ? `${hex}${alphaHex}` : hex;
}

// ------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------

interface ColourPickerProps {
  def: ColourFieldDef;
  value: string;
  onChange: (value: string) => void;
}

function ColourPicker({ def, value, onChange }: ColourPickerProps) {
  const isValid = isValidHexColour(value);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let next = e.target.value.trim();
    if (next.length > 0 && !next.startsWith('#')) {
      next = `#${next}`;
    }
    onChange(next);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{def.label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${def.label} colour picker`}
          className="w-10 h-10 p-0 border border-gray-300 rounded cursor-pointer bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          maxLength={7}
          spellCheck={false}
          aria-label={`${def.label} hex value`}
          className={`flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#4131e0] ${
            isValid ? 'border-gray-300' : 'border-red-400 bg-red-50'
          }`}
          placeholder="#5B2C83"
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{def.hint}</p>
    </div>
  );
}

interface AssetDropZoneProps {
  def: AssetFieldDef;
  previewUrl: string | null;
  isBusy: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

function AssetDropZone({ def, previewUrl, isBusy, onFile, onRemove }: AssetDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      onFile(file);
    }
    e.target.value = '';
  };

  const handleBrowse = (): void => inputRef.current?.click();

  const isDarkSurface = def.kind === 'logo_light';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{def.label}</label>
        {previewUrl && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isBusy}
            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleBrowse}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBrowse();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex items-center justify-center h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          isDragging ? 'border-[#4131e0] bg-[#E6E7FF]' : 'border-gray-300 hover:border-gray-400'
        } ${isDarkSurface ? 'bg-[#191715]' : 'bg-gray-50'}`}
      >
        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" />
          </div>
        )}
        {previewUrl ? (
          <img src={previewUrl} alt={def.label} className="max-h-24 max-w-[90%] object-contain" />
        ) : (
          <div className={`flex flex-col items-center gap-1 text-xs ${isDarkSurface ? 'text-gray-300' : 'text-gray-500'}`}>
            <Upload className="w-5 h-5" />
            <span>Drop a file or click to browse</span>
            <span className="text-[10px] opacity-75">PNG, JPG or SVG, max 2 MB</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">{def.hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}

interface DaypartsEditorProps {
  dayparts: Daypart[];
  validation: DaypartValidation;
  onChange: (next: Daypart[]) => void;
}

function DaypartsEditor({ dayparts, validation, onChange }: DaypartsEditorProps) {
  const updateRow = (index: number, patch: Partial<Daypart>): void => {
    onChange(dayparts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const removeRow = (index: number): void => {
    onChange(dayparts.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= dayparts.length) {
      return;
    }
    const next = [...dayparts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addRow = (): void => {
    const last = dayparts[dayparts.length - 1];
    const start = last && isValidTime(last.end) && last.end !== '24:00' ? last.end : '00:00';
    onChange([...dayparts, { name: '', start, end: start }]);
  };

  const resetToDefault = (): void => {
    onChange(DEFAULT_DAYPARTS.map((d) => ({ ...d })));
  };

  const inputClass = (hasError: boolean): string =>
    `w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="text-sm font-medium text-gray-700">Dayparts</label>
          <p className="text-xs text-gray-500">
            Network-specific windows used to bucket spots in reports. Times are 24h, station-local.
          </p>
        </div>
        <button
          type="button"
          onClick={resetToDefault}
          className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to default
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-2 font-medium">Name</th>
              <th className="pb-2 pr-2 font-medium w-24">Start</th>
              <th className="pb-2 pr-2 font-medium w-24">End</th>
              <th className="pb-2 w-28" />
            </tr>
          </thead>
          <tbody>
            {dayparts.map((d, i) => {
              const rowError = validation.rowErrors[i];
              return (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      placeholder="Breakfast"
                      aria-label={`Daypart ${i + 1} name`}
                      className={inputClass(!!rowError && d.name.trim() === '')}
                    />
                    {rowError && <p className="text-xs text-red-600 mt-1">{rowError}</p>}
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={d.start}
                      onChange={(e) => updateRow(i, { start: e.target.value.trim() })}
                      placeholder="05:30"
                      maxLength={5}
                      aria-label={`Daypart ${i + 1} start`}
                      className={`${inputClass(!isValidTime(d.start))} font-mono`}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={d.end}
                      onChange={(e) => updateRow(i, { end: e.target.value.trim() })}
                      placeholder="09:00"
                      maxLength={5}
                      aria-label={`Daypart ${i + 1} end`}
                      className={`${inputClass(!isValidTime(d.end))} font-mono`}
                    />
                  </td>
                  <td className="py-1">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => moveRow(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(i, 1)}
                        disabled={i === dayparts.length - 1}
                        aria-label="Move down"
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label="Remove daypart"
                        className="p-1.5 rounded text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {validation.globalErrors.length > 0 && (
        <ul className="mt-2 space-y-1">
          {validation.globalErrors.map((message) => (
            <li key={message} className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {message}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addRow}
        className="mt-3 text-sm text-[#4131e0] hover:text-[#4131e0]/80 flex items-center gap-1 font-medium"
      >
        <Plus className="w-4 h-4" />
        Add daypart
      </button>
    </div>
  );
}

interface FontFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function FontField({ id, label, value, onChange }: FontFieldProps) {
  const listId = `${id}-options`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
        style={{ fontFamily: value || undefined }}
      />
      <datalist id={listId}>
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font} />
        ))}
      </datalist>
    </div>
  );
}

// ------------------------------------------------------------
// Preview
// ------------------------------------------------------------

interface PreviewProps {
  form: BrandKitForm;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  coverUrl: string | null;
}

function TitleSlidePreview({ form, logoLightUrl, coverUrl }: PreviewProps) {
  const headingFont = `"${form.heading_font}", "Montserrat", "Segoe UI", sans-serif`;
  const bodyFont = `"${form.body_font}", "Calibri", "Segoe UI", sans-serif`;

  return (
    <div
      className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md"
      style={{
        backgroundColor: isValidHexColour(form.primary_colour) ? form.primary_colour : '#5B2C83',
        backgroundImage: coverUrl ? `url("${coverUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {coverUrl && <div className="absolute inset-0" style={{ backgroundColor: withAlpha(form.primary_colour, 'B3') }} />}

      <div className="absolute inset-0 p-[6%] flex flex-col justify-between" style={{ color: form.text_on_primary }}>
        <div className="h-[16%] flex items-center">
          {logoLightUrl ? (
            <img src={logoLightUrl} alt="Logo" className="h-full max-w-[40%] object-contain object-left" />
          ) : (
            <span className="text-[10px] uppercase tracking-widest opacity-60" style={{ fontFamily: bodyFont }}>
              Logo (light)
            </span>
          )}
        </div>

        <div>
          <div className="w-[14%] h-[3px] mb-[3%]" style={{ backgroundColor: form.accent_colour }} />
          <div className="text-[clamp(14px,3.2vw,26px)] font-bold leading-tight" style={{ fontFamily: headingFont }}>
            Campaign Name
          </div>
          <div className="text-[clamp(9px,1.6vw,13px)] mt-[1.5%] opacity-90" style={{ fontFamily: bodyFont }}>
            Post-Campaign Report · Advertiser · 1–28 Sep 2026
          </div>
        </div>

        <div className="flex items-center justify-between text-[clamp(7px,1.1vw,10px)] opacity-70" style={{ fontFamily: bodyFont }}>
          <span>{form.name || 'Brand kit'}</span>
          <span>Verified by MOTIX</span>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_ROWS: Array<[string, string, string, string]> = [
  ['Breakfast', '184', '176', '96%'],
  ['Morning', '140', '140', '100%'],
  ['Afternoon', '120', '118', '98%'],
  ['Drive', '196', '190', '97%'],
  ['Evening', '60', '61', '102%'],
];

function TableSlidePreview({ form, logoDarkUrl }: PreviewProps) {
  const headingFont = `"${form.heading_font}", "Montserrat", "Segoe UI", sans-serif`;
  const bodyFont = `"${form.body_font}", "Calibri", "Segoe UI", sans-serif`;
  const primary = isValidHexColour(form.primary_colour) ? form.primary_colour : '#5B2C83';

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md bg-white border border-gray-200">
      <div className="absolute inset-0 p-[5%] flex flex-col">
        <div className="flex items-start justify-between mb-[3%]">
          <div>
            <div className="text-[clamp(11px,2.2vw,18px)] font-bold leading-tight" style={{ fontFamily: headingFont, color: primary }}>
              Delivery by daypart
            </div>
            <div className="w-[40px] h-[2px] mt-[4px]" style={{ backgroundColor: form.accent_colour }} />
          </div>
          {logoDarkUrl ? (
            <img src={logoDarkUrl} alt="Logo" className="h-[22px] max-w-[30%] object-contain object-right" />
          ) : (
            <span className="text-[9px] uppercase tracking-widest text-gray-400" style={{ fontFamily: bodyFont }}>
              Logo (dark)
            </span>
          )}
        </div>

        <table className="w-full text-[clamp(7px,1.3vw,11px)] border-collapse" style={{ fontFamily: bodyFont }}>
          <thead>
            <tr style={{ backgroundColor: primary, color: form.text_on_primary }}>
              <th className="text-left px-[2%] py-[1.2%] font-semibold">Daypart</th>
              <th className="text-right px-[2%] py-[1.2%] font-semibold">Booked</th>
              <th className="text-right px-[2%] py-[1.2%] font-semibold">Aired</th>
              <th className="text-right px-[2%] py-[1.2%] font-semibold">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {PREVIEW_ROWS.map((row, i) => (
              <tr
                key={row[0]}
                style={{ backgroundColor: i % 2 === 1 ? withAlpha(form.secondary_colour, '40') : 'transparent' }}
                className="text-gray-800"
              >
                <td className="px-[2%] py-[1%]">{row[0]}</td>
                <td className="px-[2%] py-[1%] text-right">{row[1]}</td>
                <td className="px-[2%] py-[1%] text-right">{row[2]}</td>
                <td className="px-[2%] py-[1%] text-right font-semibold" style={{ color: form.accent_colour }}>
                  {row[3]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-auto text-[clamp(6px,1vw,9px)] text-gray-400 flex justify-between" style={{ fontFamily: bodyFont }}>
          <span>Source: MOTIX observed airplay</span>
          <span>Verified by MOTIX</span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------

export default function BrandKitSettings() {
  const { brandKit, agencyId, isLoading, isSaving, error, save, uploadAsset, removeAsset, getAssetUrl } =
    useBrandKit();
  const { addToast } = useToast();

  const [form, setForm] = useState<BrandKitForm>(() => formFromKit(null));
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(formFromKit(null)));
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);
  const [busyAsset, setBusyAsset] = useState<BrandAssetKind | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<BrandAssetKind, string | null>>({
    logo_light: null,
    logo_dark: null,
    cover_image: null,
  });

  // Hydrate the form once the kit (or its absence) is known. Re-hydrate when
  // the kit's updated_at changes so a save elsewhere is reflected.
  const kitVersion = brandKit ? `${brandKit.id}:${brandKit.updated_at}` : 'none';
  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!hasHydrated) {
      const next = formFromKit(brandKit);
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      setHasHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, kitVersion]);

  // Resolve signed URLs whenever the stored paths change.
  const logoLightPath = brandKit?.logo_light_path ?? null;
  const logoDarkPath = brandKit?.logo_dark_path ?? null;
  const coverPath = brandKit?.cover_image_path ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [logo_light, logo_dark, cover_image] = await Promise.all([
        getAssetUrl(logoLightPath),
        getAssetUrl(logoDarkPath),
        getAssetUrl(coverPath),
      ]);
      if (!cancelled) {
        setAssetUrls({ logo_light, logo_dark, cover_image });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logoLightPath, logoDarkPath, coverPath, getAssetUrl]);

  const isDirty = useMemo(() => JSON.stringify(form) !== savedSnapshot, [form, savedSnapshot]);
  const daypartValidation = useMemo(() => validateDayparts(form.dayparts), [form.dayparts]);
  const formErrors = useMemo(() => validateForm(form), [form]);
  const canSave = isDirty && formErrors.length === 0 && !isSaving && !!agencyId;

  const updateField = useCallback(<K extends keyof BrandKitForm>(key: K, value: BrandKitForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async (): Promise<void> => {
    if (formErrors.length > 0) {
      addToast('error', formErrors[0]);
      return;
    }
    const result = await save({
      name: form.name.trim(),
      primary_colour: form.primary_colour.toUpperCase(),
      secondary_colour: form.secondary_colour.toUpperCase(),
      accent_colour: form.accent_colour.toUpperCase(),
      text_on_primary: form.text_on_primary.toUpperCase(),
      heading_font: form.heading_font.trim(),
      body_font: form.body_font.trim(),
      dayparts: form.dayparts.map((d) => ({ name: d.name.trim(), start: d.start, end: d.end })),
      tone_description: form.tone_description.trim() || null,
      tone_reference: form.tone_reference.trim() || null,
    });
    if (result.success) {
      const normalised: BrandKitForm = {
        ...form,
        name: form.name.trim(),
        primary_colour: form.primary_colour.toUpperCase(),
        secondary_colour: form.secondary_colour.toUpperCase(),
        accent_colour: form.accent_colour.toUpperCase(),
        text_on_primary: form.text_on_primary.toUpperCase(),
        heading_font: form.heading_font.trim(),
        body_font: form.body_font.trim(),
        dayparts: form.dayparts.map((d) => ({ name: d.name.trim(), start: d.start, end: d.end })),
        tone_description: form.tone_description.trim(),
        tone_reference: form.tone_reference.trim(),
      };
      setForm(normalised);
      setSavedSnapshot(JSON.stringify(normalised));
      addToast('success', 'Brand kit saved.');
    } else {
      addToast('error', result.error ?? 'Failed to save brand kit.');
    }
  };

  const handleDiscard = (): void => {
    setForm(JSON.parse(savedSnapshot) as BrandKitForm);
  };

  const handleAssetFile = async (kind: BrandAssetKind, file: File): Promise<void> => {
    const validationError = validateBrandAsset(file);
    if (validationError) {
      addToast('error', validationError);
      return;
    }
    setBusyAsset(kind);
    const result = await uploadAsset(file, kind);
    setBusyAsset(null);
    if (result.success) {
      addToast('success', `${ASSET_FIELDS.find((a) => a.kind === kind)?.label ?? 'Asset'} uploaded.`);
    } else {
      addToast('error', result.error ?? 'Upload failed.');
    }
  };

  const handleAssetRemove = async (kind: BrandAssetKind): Promise<void> => {
    setBusyAsset(kind);
    const result = await removeAsset(kind);
    setBusyAsset(null);
    if (result.success) {
      addToast('info', `${ASSET_FIELDS.find((a) => a.kind === kind)?.label ?? 'Asset'} removed.`);
    } else {
      addToast('error', result.error ?? 'Failed to remove asset.');
    }
  };

  const previewProps: PreviewProps = {
    form,
    logoLightUrl: assetUrls.logo_light,
    logoDarkUrl: assetUrls.logo_dark,
    coverUrl: assetUrls.cover_image,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#191715] flex items-center gap-2">
              <Palette className="w-6 h-6 text-[#4131e0]" />
              Brand kit
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Colours, fonts, logos and dayparts applied to every Post-Campaign Report your team generates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
            {isDirty && (
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="bg-[#4131e0] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#4131e0]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              {!agencyId && (
                <p className="text-xs mt-1 text-red-700">
                  Ask an administrator to set <code>app_metadata.agency_id</code> on your user in Supabase.
                </p>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-3 text-sm text-gray-500 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" />
            Loading brand kit…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT: form */}
            <div className="lg:col-span-3 space-y-6">
              <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Identity</h2>

                <div>
                  <label htmlFor="kit-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Kit name
                  </label>
                  <input
                    id="kit-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                    placeholder="Nova Entertainment"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {COLOUR_FIELDS.map((def) => (
                    <ColourPicker
                      key={def.key}
                      def={def}
                      value={form[def.key]}
                      onChange={(value) => updateField(def.key, value)}
                    />
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Typography</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FontField
                    id="heading-font"
                    label="Heading font"
                    value={form.heading_font}
                    onChange={(value) => updateField('heading_font', value)}
                  />
                  <FontField
                    id="body-font"
                    label="Body font"
                    value={form.body_font}
                    onChange={(value) => updateField('body_font', value)}
                  />
                </div>
                <p className="text-xs text-gray-500">{FONT_HELPER_TEXT}</p>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Report voice</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    The report writer matches this voice. Leave blank for a neutral factual tone.
                  </p>
                </div>
                <div>
                  <label htmlFor="tone-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Tone description
                  </label>
                  <textarea
                    id="tone-description"
                    value={form.tone_description}
                    onChange={(e) => updateField('tone_description', e.target.value)}
                    rows={2}
                    placeholder="e.g. warm, playful, confident, second person"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  />
                </div>
                <div>
                  <label htmlFor="tone-reference" className="block text-sm font-medium text-gray-700 mb-1">
                    Reference copy (optional)
                  </label>
                  <textarea
                    id="tone-reference"
                    value={form.tone_reference}
                    onChange={(e) => updateField('tone_reference', e.target.value)}
                    rows={4}
                    placeholder="Paste a past campaign overview paragraph or two in your house voice. Used to guide voice only — never copied into reports."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  />
                </div>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Logos &amp; imagery</h2>
                  <p className="text-xs text-gray-500 mt-1">Uploads are saved immediately.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {ASSET_FIELDS.map((def) => (
                    <AssetDropZone
                      key={def.kind}
                      def={def}
                      previewUrl={assetUrls[def.kind]}
                      isBusy={busyAsset === def.kind}
                      onFile={(file) => void handleAssetFile(def.kind, file)}
                      onRemove={() => void handleAssetRemove(def.kind)}
                    />
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-5">
                <DaypartsEditor
                  dayparts={form.dayparts}
                  validation={daypartValidation}
                  onChange={(next) => updateField('dayparts', next)}
                />
              </section>

              {formErrors.length > 0 && isDirty && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Fix before saving</p>
                  <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                    {formErrors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* RIGHT: live preview */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-6 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Live preview</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    How your title and table slides will look. Fonts render here only if installed on this machine.
                  </p>
                </div>
                <TitleSlidePreview {...previewProps} />
                <TableSlidePreview {...previewProps} />
                <p className="text-[11px] text-gray-400">
                  {brandKit
                    ? `Last saved ${new Date(brandKit.updated_at).toLocaleString('en-AU')}`
                    : 'Not saved yet — showing defaults.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
