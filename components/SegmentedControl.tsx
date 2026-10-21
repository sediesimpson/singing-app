type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

// A pill-shaped switch where exactly one option is selected.
// Full width with equal-width options on phones; sized to its content from `sm` up.
export function SegmentedControl<T extends string>({ options, value, onChange, disabled = false }: Props<T>) {
  return (
    <div className="flex w-full rounded-full bg-gray-100 p-1 text-sm sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          disabled={disabled}
          className={`flex-1 rounded-full px-3 py-1.5 transition disabled:cursor-not-allowed sm:flex-none sm:py-1 ${
            value === o.value ? "bg-white font-medium shadow-sm" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
