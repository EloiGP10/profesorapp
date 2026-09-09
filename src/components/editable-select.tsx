"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

interface EditableSelectProps {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EditableSelect({ value, options, placeholder, onChange, className = "" }: EditableSelectProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(text.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      onChange(text || "none");
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent"
            onClick={() => {
              setOpen(false);
              onChange(text || "none");
            }}
          >
            <span>{text || placeholder}</span>
            {text && <X className="h-4 w-4" />}
          </button>
          {filteredOptions.map((option) => (
            <button
              type="button"
              key={option}
              className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                setText(option);
                onChange(option);
                setOpen(false);
              }}
            >
              <span>{option}</span>
              {option === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
