import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState, useMemo, useCallback, type ReactNode } from "react";
import { AUTH_BTN } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { OnboardingPhoneInput } from "./onboarding-phone-input";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^[0-9+\-\s()]{6,20}$/;

interface OnboardingFormField {
  id: string;
  label: string;
  type: "text" | "email" | "password" | "tel";
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

interface OnboardingFormProps {
  fields: OnboardingFormField[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
  subtitle?: string;
  title?: string;
  belowFields?: ReactNode;
}

export function OnboardingForm({
  fields,
  onSubmit,
  submitLabel = "Continue",
  isLoading = false,
  subtitle,
  title,
  belowFields,
}: OnboardingFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>(
    fields.reduce((acc, field) => ({ ...acc, [field.id]: "" }), {}),
  );
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation rules
  const validateField = useCallback(
    (fieldId: string, value: string): string | null => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return null;

      if (field.required && !value?.trim()) {
        return `${field.label} is required`;
      }

      if (value && field.type === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return "Enter a valid email address";
        }
      }

      if (value && field.type === "tel") {
        if (value.trim().length < 6) {
          return "Phone number too short (minimum 6 digits)";
        }
        if (!PHONE_REGEX.test(value)) {
          return "Enter a valid phone number (6–20 digits)";
        }
      }

      if (value && field.type === "password" && field.minLength) {
        if (value.length < field.minLength) {
          return `Password must be at least ${field.minLength} characters`;
        }
      }

      return null;
    },
    [fields],
  );

  const handleFieldChange = useCallback(
    (fieldId: string, value: string) => {
      setFormData((prev) => ({ ...prev, [fieldId]: value }));
      setTouchedFields((prev) => new Set(prev).add(fieldId));

      const error = validateField(fieldId, value);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) next[fieldId] = error;
        else delete next[fieldId];
        return next;
      });
    },
    [validateField],
  );

  const handleFieldBlur = useCallback((fieldId: string) => {
    setTouchedFields((prev) => new Set(prev).add(fieldId));
  }, []);

  // Check form validity
  const isFormValid = useMemo(() => {
    return (
      fields.every((field) => {
        if (field.required) {
          const value = formData[field.id]?.trim();
          return value && !errors[field.id];
        }
        return !errors[field.id];
      }) && Object.keys(errors).every((key) => !errors[key])
    );
  }, [formData, errors, fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const error = validateField(field.id, formData[field.id]);
      if (error) {
        newErrors[field.id] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouchedFields(new Set(fields.map((f) => f.id)));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={handleSubmit}
      className="w-full space-y-6"
    >
      {(title || subtitle) && (
        <div className="space-y-2">
          {title && (
            <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm leading-relaxed text-slate">{subtitle}</p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {fields.map((field, index) => {
            const value = formData[field.id];
            const error = errors[field.id];
            const isTouched = touchedFields.has(field.id);

            return (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="space-y-2"
              >
                {field.type === "tel" ? (
                  <OnboardingPhoneInput
                    value={value}
                    onChange={(val) => handleFieldChange(field.id, val)}
                    error={error}
                    touched={isTouched}
                    required={field.required}
                    placeholder={field.placeholder}
                    helperText={field.helperText}
                    label={field.label}
                  />
                ) : (
                  <>
                    <Label htmlFor={field.id}>
                      {field.label}
                      {field.required && (
                        <span className="text-destructive font-semibold">
                          *
                        </span>
                      )}
                    </Label>

                    {field.type === "password" ? (
                      <PasswordInput
                        id={field.id}
                        required={field.required}
                        minLength={field.minLength}
                        value={value}
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
                        onBlur={() => handleFieldBlur(field.id)}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        className={cn(
                          "!rounded-[4px] transition-[border-color,background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)]",
                          isTouched &&
                            error &&
                            "border-destructive/50 bg-destructive/5 focus:ring-destructive/30",
                        )}
                        aria-invalid={isTouched && !!error}
                        aria-describedby={
                          error ? `${field.id}-error` : undefined
                        }
                        disabled={isSubmitting || isLoading}
                      />
                    ) : (
                      <Input
                        id={field.id}
                        type={field.type}
                        required={field.required}
                        minLength={field.minLength}
                        value={value}
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
                        onBlur={() => handleFieldBlur(field.id)}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        className={cn(
                          "!rounded-[4px] transition-[border-color,background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)]",
                          isTouched &&
                            error &&
                            "border-destructive/50 bg-destructive/5 focus:ring-destructive/30",
                        )}
                        aria-invalid={isTouched && !!error}
                        aria-describedby={
                          error ? `${field.id}-error` : undefined
                        }
                        disabled={isSubmitting || isLoading}
                      />
                    )}

                    {/* Error Message */}
                    <AnimatePresence mode="wait">
                      {isTouched && error && (
                        <motion.p
                          key="error"
                          id={`${field.id}-error`}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="text-xs text-destructive flex items-center gap-1.5"
                        >
                          <span className="block h-1 w-1 rounded-full bg-destructive/60" />
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Helper Text */}
                    {field.helperText && !error && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-slate"
                      >
                        {field.helperText}
                      </motion.p>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {belowFields}

      <Button
        type="submit"
        disabled={!isFormValid || isSubmitting || isLoading}
        size="lg"
        className={cn(
          AUTH_BTN,
          "w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90",
        )}
      >
        {(isSubmitting || isLoading) && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {submitLabel}
      </Button>
    </motion.form>
  );
}
