const DAYS_OF_WEEK: Array<{ label: string; value: string; short: string }> = [
  { label: 'Monday', value: 'M', short: 'Mo' },
  { label: 'Tuesday', value: 'T', short: 'Tu' },
  { label: 'Wednesday', value: 'W', short: 'We' },
  { label: 'Thursday', value: 'H', short: 'Th' },
  { label: 'Friday', value: 'F', short: 'Fr' },
  { label: 'Saturday', value: 'A', short: 'Sa' },
  { label: 'Sunday', value: 'S', short: 'Su' },
];

interface DaySelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function DaySelector({ value, onChange, className }: DaySelectorProps) {
  const handleToggleDay = (dayValue: string): void => {
    const selected = new Set(value.split('').filter((c) => c.length > 0));
    if (selected.has(dayValue)) {
      selected.delete(dayValue);
    } else {
      selected.add(dayValue);
    }
    const newValue = DAYS_OF_WEEK.filter((d) => selected.has(d.value))
      .map((d) => d.value)
      .join('');
    onChange(newValue);
  };

  return (
    <div className={`flex gap-1.5 flex-wrap ${className ?? ''}`}>
      {DAYS_OF_WEEK.map((day) => {
        const isSelected = value.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => handleToggleDay(day.value)}
            title={day.label}
            aria-label={day.label}
            aria-pressed={isSelected}
            className={`w-9 h-9 rounded-lg text-label font-semibold transition-all interactive-base ${
              isSelected
                ? 'bg-[#4131e0] text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

export { DAYS_OF_WEEK };
