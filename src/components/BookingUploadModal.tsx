import React, { useState, useRef } from 'react';
import { X, Upload, CreditCard as Edit3, Trash2 } from 'lucide-react';
import DaySelector from './DaySelector';

export interface ParsedBooking {
  station: string;
  brand: string;
  startDate: string;
  endDate: string;
  totalSpots: number;
  flighting: string;
}

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  station: string;
  brand: string;
  startDate: string;
  endDate: string;
  totalSpots: string;
  flighting: string;
}

type ModalStep = 'choice' | 'upload' | 'map' | 'review' | 'competitors';

interface BookingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (bookings: ParsedBooking[], competitors: string[]) => void;
}

const FLIGHTING_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Daily (Mon–Sun)', value: 'MTWHFAS' },
  { label: 'Weekdays (Mon–Fri)', value: 'MTWHF' },
  { label: 'Mon / Wed / Fri', value: 'MWF' },
  { label: 'Weekend', value: 'AS' },
  { label: 'Custom', value: '' },
];

function parseCSVText(text: string): CSVData {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  );
  return { headers, rows };
}

function applyColumnMapping(data: CSVData, mapping: ColumnMapping): ParsedBooking[] {
  return data.rows
    .filter((row) => row.some((cell) => cell.length > 0))
    .map((row) => ({
      station: row[data.headers.indexOf(mapping.station)] ?? '',
      brand: row[data.headers.indexOf(mapping.brand)] ?? '',
      startDate: row[data.headers.indexOf(mapping.startDate)] ?? '',
      endDate: row[data.headers.indexOf(mapping.endDate)] ?? '',
      totalSpots: parseInt(row[data.headers.indexOf(mapping.totalSpots)] ?? '0', 10),
      flighting: mapping.flighting ? row[data.headers.indexOf(mapping.flighting)] ?? 'daily' : 'daily',
    }));
}

export default function BookingUploadModal({ isOpen, onClose, onComplete }: BookingUploadModalProps) {
  const [step, setStep] = useState<ModalStep>('choice');
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    station: '',
    brand: '',
    startDate: '',
    endDate: '',
    totalSpots: '',
    flighting: '',
  });
  const [parsedBookings, setParsedBookings] = useState<ParsedBooking[]>([]);
  const [competitors, setCompetitors] = useState<string[]>(['']);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [flightingValue, setFlightingValue] = useState<string>('MTWHF');
  const [flightingPreset, setFlightingPreset] = useState<string>('MTWHF');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>): void => {
      const text = e.target?.result as string;
      const data = parseCSVText(text);
      if (data.headers.length < 2) {
        setParseError('File does not appear to be a valid CSV. Please check the format and try again.');
        return;
      }
      setCsvData(data);
      setParseError(null);
      setStep('map');
    };
    reader.readAsText(file);
  };

  const handleClose = (): void => {
    setStep('choice');
    setCsvData(null);
    setParsedBookings([]);
    setCompetitors(['']);
    setParseError(null);
    setMappingError(null);
    setFlightingValue('MTWHF');
    setFlightingPreset('MTWHF');
    setColumnMapping({
      station: '',
      brand: '',
      startDate: '',
      endDate: '',
      totalSpots: '',
      flighting: '',
    });
    onClose();
  };

  const handleBack = (): void => {
    if (step === 'upload') setStep('choice');
    else if (step === 'map') setStep('upload');
    else if (step === 'review') setStep(csvData ? 'map' : 'choice');
    else if (step === 'competitors') setStep('review');
  };

  const handleChooseUpload = (): void => {
    setStep('upload');
  };

  const handleChooseManual = (): void => {
    setParsedBookings([
      { station: '', brand: '', startDate: '', endDate: '', totalSpots: 0, flighting: 'daily' },
    ]);
    setStep('review');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleClickZone = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string): void => {
    setColumnMapping((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinueFromMapping = (): void => {
    if (
      !columnMapping.station ||
      !columnMapping.brand ||
      !columnMapping.startDate ||
      !columnMapping.endDate ||
      !columnMapping.totalSpots
    ) {
      setMappingError('Please map all required fields before continuing.');
      return;
    }
    if (csvData) {
      const bookings = applyColumnMapping(csvData, columnMapping);
      setParsedBookings(bookings);
      setMappingError(null);
      setStep('review');
    }
  };

  const handleAddRow = (): void => {
    setParsedBookings((prev) => [
      ...prev,
      { station: '', brand: '', startDate: '', endDate: '', totalSpots: 0, flighting: 'daily' },
    ]);
  };

  const handleRemoveRow = (index: number): void => {
    setParsedBookings((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBookingChange = (index: number, field: keyof ParsedBooking, value: string | number): void => {
    setParsedBookings((prev) =>
      prev.map((booking, i) =>
        i === index ? { ...booking, [field]: value } : booking
      )
    );
  };

  const handleCompetitorChange = (index: number, value: string): void => {
    setCompetitors((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const handleAddCompetitor = (): void => {
    setCompetitors((prev) => [...prev, '']);
  };

  const handleRemoveCompetitor = (index: number): void => {
    setCompetitors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFlightingPresetChange = (value: string): void => {
    setFlightingPreset(value);
    if (value !== '') {
      setFlightingValue(value);
    }
  };

  const handleFlightingDayChange = (value: string): void => {
    setFlightingValue(value);
    setFlightingPreset('');
  };

  const handleCompleteSetup = (): void => {
    const filteredCompetitors = competitors.filter((c) => c.trim().length > 0);
    const bookingsWithFlighting = parsedBookings.map((b) => ({
      ...b,
      flighting: flightingValue || b.flighting || 'daily',
    }));
    onComplete(bookingsWithFlighting, filteredCompetitors);
    handleClose();
  };

  const handleSkipCompetitors = (): void => {
    const bookingsWithFlighting = parsedBookings.map((b) => ({
      ...b,
      flighting: flightingValue || b.flighting || 'daily',
    }));
    onComplete(bookingsWithFlighting, []);
    handleClose();
  };

  const getStepTitle = (): string => {
    switch (step) {
      case 'choice':
        return 'Import Campaign Schedule';
      case 'upload':
        return 'Upload Booking CSV';
      case 'map':
        return 'Map Your Columns';
      case 'review':
        return 'Review Bookings';
      case 'competitors':
        return 'Add Competitors';
      default:
        return '';
    }
  };

  const getStepNumber = (): number => {
    switch (step) {
      case 'choice':
      case 'upload':
        return 1;
      case 'map':
        return 2;
      case 'review':
        return 3;
      case 'competitors':
        return 4;
      default:
        return 1;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading-3 text-[#191715]">{getStepTitle()}</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 interactive-base"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((stepNum) => {
              const currentStep = getStepNumber();
              const isCompleted = stepNum < currentStep;
              const isActive = stepNum === currentStep;
              return (
                <div
                  key={stepNum}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted
                      ? 'bg-[#00d76f] text-white'
                      : isActive
                        ? 'bg-[#4131e0] text-white'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {stepNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'choice' && (
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={handleChooseUpload}
                className="border-2 border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#4131e0] hover:bg-[#4131e0]/5 interactive-base transition-all"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-body font-semibold text-[#191715] mb-1">Upload CSV</h3>
                <p className="text-body-sm text-gray-500">
                  Map columns from your existing schedule format
                </p>
              </div>

              <div
                onClick={handleChooseManual}
                className="border-2 border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#4131e0] hover:bg-[#4131e0]/5 interactive-base transition-all"
              >
                <Edit3 className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-body font-semibold text-[#191715] mb-1">Enter Manually</h3>
                <p className="text-body-sm text-gray-500">
                  Type station, dates, and spot counts directly
                </p>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClickZone}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-[#4131e0] bg-[#4131e0]/5' : 'border-gray-300 hover:border-[#4131e0]'
                }`}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                <p className="text-body text-gray-700 mb-1">Drop your CSV file here</p>
                <p className="text-body-sm text-gray-500">or click to browse</p>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
              {parseError && (
                <p className="text-body-sm text-red-600 mt-3">{parseError}</p>
              )}
              <button
                onClick={handleBack}
                className="text-body-sm text-gray-500 hover:text-gray-700 interactive-base mt-4"
              >
                ← Back
              </button>
            </div>
          )}

          {step === 'map' && csvData && (
            <div>
              <div className="space-y-4">
                {[
                  { field: 'station', label: 'Station', required: true },
                  { field: 'brand', label: 'Brand/Advertiser', required: true },
                  { field: 'startDate', label: 'Start Date', required: true },
                  { field: 'endDate', label: 'End Date', required: true },
                  { field: 'totalSpots', label: 'Total Spots', required: true },
                  { field: 'flighting', label: 'Flighting', required: false },
                ].map(({ field, label, required }) => (
                  <div key={field}>
                    <label className="block text-label text-gray-700 mb-2">
                      {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={columnMapping[field as keyof ColumnMapping]}
                      onChange={(e) => handleMappingChange(field as keyof ColumnMapping, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                    >
                      <option value="">Select column...</option>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {mappingError && (
                <p className="text-body-sm text-red-600 mt-3">{mappingError}</p>
              )}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleBack}
                  className="text-body-sm text-gray-500 hover:text-gray-700 interactive-base"
                >
                  ← Back
                </button>
                <button
                  onClick={handleContinueFromMapping}
                  className="flex-1 bg-[#4131e0] text-white py-2.5 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-label text-gray-500 text-left pb-2 pr-3">Station</th>
                      <th className="text-label text-gray-500 text-left pb-2 pr-3">Brand</th>
                      <th className="text-label text-gray-500 text-left pb-2 pr-3">Start</th>
                      <th className="text-label text-gray-500 text-left pb-2 pr-3">End</th>
                      <th className="text-label text-gray-500 text-left pb-2 pr-3">Spots</th>
                      <th className="text-label text-gray-500 text-left pb-2 pr-3">Flighting</th>
                      <th className="text-label text-gray-500 text-left pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBookings.map((booking, index) => (
                      <tr key={`booking-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={booking.station}
                            onChange={(e) => handleBookingChange(index, 'station', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={booking.brand}
                            onChange={(e) => handleBookingChange(index, 'brand', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={booking.startDate}
                            onChange={(e) => handleBookingChange(index, 'startDate', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={booking.endDate}
                            onChange={(e) => handleBookingChange(index, 'endDate', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={booking.totalSpots}
                            onChange={(e) => handleBookingChange(index, 'totalSpots', parseInt(e.target.value, 10) || 0)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={booking.flighting}
                            onChange={(e) => handleBookingChange(index, 'flighting', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleRemoveRow(index)}
                            className="text-gray-400 hover:text-red-500 interactive-base"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleAddRow}
                className="text-body-sm text-[#4131e0] hover:underline interactive-base mb-6"
              >
                + Add row
              </button>

              <div className="mt-6 border-t border-gray-100 pt-5">
                <p className="text-label text-gray-500 mb-3">CAMPAIGN FLIGHTING</p>
                <p className="text-body-sm text-gray-600 mb-4">
                  Set the days this campaign is scheduled to run. This is used for daypart compliance checking.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {FLIGHTING_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleFlightingPresetChange(preset.value)}
                      className={`px-3 py-1.5 rounded-lg text-label font-medium transition-all interactive-base ${
                        flightingPreset === preset.value && preset.value !== ''
                          ? 'bg-[#4131e0] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <DaySelector value={flightingValue} onChange={handleFlightingDayChange} />

                {flightingValue.length === 0 && (
                  <p className="text-label text-red-500 mt-2">Select at least one day</p>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleBack}
                  className="text-body-sm text-gray-500 hover:text-gray-700 interactive-base"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('competitors')}
                  className="flex-1 bg-[#4131e0] text-white py-2.5 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base"
                >
                  Continue to Competitors →
                </button>
              </div>
            </div>
          )}

          {step === 'competitors' && (
            <div>
              <p className="text-body text-gray-600 mb-4">
                Add brands to monitor for share-of-voice comparison. These will appear in the
                Competitor Analysis widget.
              </p>

              <div className="space-y-3 mb-6">
                {competitors.map((competitor, index) => (
                  <div key={`competitor-${index}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={competitor}
                      onChange={(e) => handleCompetitorChange(index, e.target.value)}
                      placeholder="Brand name"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                    />
                    {competitors.length > 1 && (
                      <button
                        onClick={() => handleRemoveCompetitor(index)}
                        className="text-gray-400 hover:text-red-500 interactive-base"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddCompetitor}
                className="text-body-sm text-[#4131e0] hover:underline interactive-base mb-6"
              >
                + Add another
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="text-body-sm text-gray-500 hover:text-gray-700 interactive-base"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSkipCompetitors}
                  className="text-body-sm text-gray-500 hover:text-gray-700 interactive-base"
                >
                  Skip →
                </button>
                <button
                  onClick={handleCompleteSetup}
                  className="flex-1 bg-[#4131e0] text-white py-2.5 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base"
                >
                  Complete Setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
