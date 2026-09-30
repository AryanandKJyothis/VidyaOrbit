import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

export function OnboardingForm({
  fields,
  onSubmit,
  submitLabel = "Continue",
  isLoading = false,
  subtitle,
  title,
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

  const completedFieldsCount = useMemo(() => {
    return fields.filter((field) => {
      const value = formData[field.id]?.trim();
      return value && !errors[field.id];
    }).length;
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
      {/* Header */}
      {(title || subtitle) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-2 mb-6"
        >
          {title && (
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </motion.div>
      )}

      {/* Progress Indicator */}
      {fields.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-teal to-brand-saffron rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${(completedFieldsCount / fields.length) * 100}%`,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {completedFieldsCount}/{fields.length}
          </span>
        </motion.div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {fields.map((field, index) => {
            const value = formData[field.id];
            const error = errors[field.id];
            const isTouched = touchedFields.has(field.id);
            const isComplete = value?.trim() && !error;

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
                    <Label
                      htmlFor={field.id}
                      className="flex items-center gap-2"
                    >
                      <span>
                        {field.label}
                        {field.required && (
                          <span className="text-destructive font-semibold">
                            *
                          </span>
                        )}
                      </span>
                      {isComplete && (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                    </Label>

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
                        "transition-all duration-200",
                        isTouched &&
                          error &&
                          "border-destructive/50 bg-destructive/5 focus:ring-destructive/30",
                        isComplete &&
                          "border-success/50 bg-success/5 focus:ring-success/30",
                      )}
                      aria-invalid={isTouched && !!error}
                      aria-describedby={error ? `${field.id}-error` : undefined}
                      disabled={isSubmitting || isLoading}
                    />

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
                          className="text-xs text-destructive/80 flex items-center gap-1.5"
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
                        className="text-xs text-muted-foreground"
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

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="space-y-3 pt-4"
      >
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting || isLoading}
          size="lg"
          className={cn(
            "w-full transition-all duration-200 flex items-center justify-center gap-2",
            isFormValid && "shadow-md hover:shadow-lg",
          )}
        >
          {isSubmitting || isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{submitLabel}</span>
              {isFormValid && <ArrowRight className="h-4 w-4" />}
            </>
          )}
        </Button>

        {/* Completion Status Message */}
        {!isFormValid && completedFieldsCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center"
          >
            Complete all required fields to continue
          </motion.p>
        )}
      </motion.div>
    </motion.form>
  );
}
