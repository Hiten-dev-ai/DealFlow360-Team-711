import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  ariaLabel: string;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

export function CustomSelect({
  options,
  value,
  defaultValue,
  name,
  ariaLabel,
  icon,
  disabled = false,
  className = "",
  onChange,
}: CustomSelectProps) {
  const listboxId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value ?? "",
  );
  const selectedValue = value ?? internalValue;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  const choose = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      choose(options[activeIndex]?.value ?? selectedValue);
      return;
    }
    const direction = event.key === "ArrowDown" ? 1 : -1;
    setActiveIndex((current) =>
      (current + direction + options.length) % options.length,
    );
  };

  return (
    <div className={`custom-select ${open ? "open" : ""} ${className}`.trim()} ref={root}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        ref={trigger}
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        {icon && <span className="custom-select-icon">{icon}</span>}
        <span className="custom-select-value">
          <strong>{selected?.label ?? "Select"}</strong>
          {selected?.detail && <small>{selected.detail}</small>}
        </span>
        <ChevronDown className="custom-select-chevron" size={16} />
      </button>
      {open && (
        <div className="custom-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              className={`${option.value === selectedValue ? "selected" : ""} ${index === activeIndex ? "active" : ""}`.trim()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option.value)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.detail && <small>{option.detail}</small>}
              </span>
              {option.value === selectedValue && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
