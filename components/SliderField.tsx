interface SliderFieldProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  color?: "blue" | "green";
  onChange: (value: number) => void;
}

export default function SliderField({
  label,
  min,
  max,
  step,
  value,
  unit,
  color = "blue",
  onChange
}: SliderFieldProps) {
  const tone = color === "green";
  return (
    <div className="rounded-[22px] bg-[#F4F8FF] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[17px] font-semibold text-[#2C3E50]">{label}</p>
        <p className={`text-[20px] font-semibold ${tone ? "text-[#5FA287]" : "text-[#8AB4F8]"}`}>
          {value}
          {unit || ""}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-3 w-full cursor-pointer appearance-none rounded-full ${tone ? "bg-[#D4EDDA] accent-[#5FA287]" : "bg-[#DFE9F8] accent-[#8AB4F8]"}`}
      />
    </div>
  );
}
