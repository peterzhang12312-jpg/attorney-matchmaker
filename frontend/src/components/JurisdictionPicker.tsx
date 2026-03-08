interface JurisdictionPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

const JURISDICTIONS = [
  { value: "cacd", label: "C.D. Cal." },
  { value: "cand", label: "N.D. Cal." },
  { value: "cal", label: "Cal. State" },
  { value: "calctapp", label: "Cal. Ct. App." },
  { value: "nyed", label: "E.D.N.Y." },
  { value: "nysd", label: "S.D.N.Y." },
  { value: "ny", label: "N.Y. State" },
] as const;

export default function JurisdictionPicker({
  selected,
  onChange,
}: JurisdictionPickerProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
        Jurisdiction Filter
      </label>
      <div className="flex flex-wrap gap-2">
        {JURISDICTIONS.map((j) => {
          const active = selected.includes(j.value);
          return (
            <button
              key={j.value}
              type="button"
              onClick={() => toggle(j.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                active
                  ? "bg-[rgba(252,170,45,0.12)] text-[#191918] border-[rgba(252,170,45,0.4)] ring-1 ring-[rgba(252,170,45,0.3)]"
                  : "bg-white text-[rgba(25,25,24,0.5)] border-[rgba(25,25,24,0.12)] hover:border-[rgba(25,25,24,0.22)] hover:text-[#191918]"
              }`}
            >
              {j.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
