import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Phone } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^[0-9+\-\s()]{6,20}$/;

export type PhoneValidationState = "empty" | "invalid" | "valid" | "partial";

interface OnboardingPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  label?: string;
  className?: string;
}

export function OnboardingPhoneInput({
  value,
  onChange,
  error,
  touched = false,
  disabled = false,
  required = true,
  placeholder = "+91 98765 43210",
  helperText,
  label = "Phone number",
  className,
}: OnboardingPhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Determine validation state
  const validationState = useMemo(() => {
    if (!value) return "empty" as const;
    const trimmed = value.trim();
    if (!trimmed) return "empty" as const;
    if (trimmed.length < 6) return "partial" as const;
    if (!PHONE_REGEX.test(trimmed)) return "invalid" as const;
    return "valid" as const;
  }, [value]);

  const isValid = validationState === "valid";
  const isInvalid = validationState === "invalid";
  const isPartial = validationState === "partial" && touched;
  const showError = (isInvalid || isPartial) && (touched || isFocused);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const borderColorClass = cn(
    "border-input transition-all duration-200",
    isFocused && "border-primary/40",
    isValid && "border-success/50 bg-success/5",
    isInvalid && "border-destructive/50 bg-destructive/5",
    isPartial && "border-warning/50 bg-warning/5"
  );

  const focusRingClass = cn(
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
    isValid && "focus:ring-success/30",
    isInvalid && "focus:ring-destructive/30",
    isPartial && "focus:ring-warning/30",
    !isValid && !isInvalid && !isPartial && "focus:ring-primary/30"
  );

  const getErrorMessage = () => {
    if (error) return error;
    if (isPartial) return "Phone number too short (minimum 6 digits)";
    if (isInvalid) return "Enter a valid phone number (6–20 digits, can include +, -, (), spaces)";
    return null;
  };

  const errorMsg = getErrorMessage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("space-y-2", className)}
    >
      <Label htmlFor="phone-input" className="flex items-center gap-1">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span>
          {label}
          {required && <span className="ml-1 text-destructive font-semibold">*</span>}
        </span>
      </Label>

      <div className="relative group">
        <Input
          id="phone-input"
          type="tel"
          required={required}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "pr-10 pl-4",
            borderColorClass,
            focusRingClass,
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-invalid={isInvalid || isPartial}
          aria-describedby={errorMsg ? "phone-error" : helperText ? "phone-helper" : undefined}
          inputMode="tel"
        />

        {/* Validation Indicator Icon */}
        <AnimatePresence mode="wait">
          {value && (
            <motion.div
              key={validationState}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              {isValid && (
                <motion.div
                  initial={{ rotate: -45 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <CheckCircle2 className="h-5 w-5 text-success" aria-label="Phone number is valid" />
                </motion.div>
              )}
              {isInvalid && (
                <motion.div
                  initial={{ rotate: 45 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <AlertCircle className="h-5 w-5 text-destructive" aria-label="Phone number is invalid" />
                </motion.div>
              )}
              {isPartial && !isFocused && (
                <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error/Warning Message */}
      <AnimatePresence mode="wait">
        {errorMsg && (
          <motion.div
            key="error"
            id="phone-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex items-start gap-2 text-xs rounded-md p-2.5",
              isPartial && "bg-warning/10 text-warning/80",
              isInvalid && "bg-destructive/10 text-destructive/80"
            )}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-snug">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper/Info Text */}
      {helperText && !errorMsg && (
        <motion.p
          id="phone-helper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground leading-snug"
        >
          {helperText}
        </motion.p>
      )}

      {/* Success State Info */}
      {isValid && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-xs text-success/80 leading-snug flex items-center gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Phone number is valid
        </motion.p>
      )}
    </motion.div>
  );
}
