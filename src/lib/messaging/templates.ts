import { formatDate } from "@/lib/format";
import type { MessageLocale } from "./types";

export const ABSENCE_TEMPLATE_KEY = "absence.v1";

export type AbsenceTemplateInput = {
  studentName: string;
  centreName: string;
  sessionDate: string;
  batchName: string;
};

type TemplateFn = (input: AbsenceTemplateInput) => string;

function formatSessionDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return formatDate(new Date(Date.UTC(year, month - 1, date, 12, 0, 0)));
}

const enAbsence: TemplateFn = ({
  studentName,
  centreName,
  sessionDate,
  batchName,
}) => {
  const name = studentName.trim() || "your child";
  const centre = centreName.trim() || "the centre";
  const batch = batchName.trim() || "class";
  const date = formatSessionDate(sessionDate);
  return `Dear parent, ${name} was absent today (${date}, ${batch}) at ${centre}. Please contact us if this is unexpected.`;
};

/**
 * Phase B hook. Malayalam renderer stays null until that work lands.
 * `renderAbsenceTemplate("ml")` falls back to English.
 */
export const ABSENCE_TEMPLATES: Record<MessageLocale, TemplateFn | null> = {
  en: enAbsence,
  ml: null,
};

export function resolveMessageLocale(
  raw: string | null | undefined,
): MessageLocale {
  return raw === "ml" ? "ml" : "en";
}

export function renderAbsenceTemplate(
  input: AbsenceTemplateInput,
  locale: string | null | undefined = "en",
): { body: string; locale: MessageLocale; templateKey: string } {
  const requested = resolveMessageLocale(locale);
  const used: MessageLocale = ABSENCE_TEMPLATES[requested] ? requested : "en";
  const renderer = ABSENCE_TEMPLATES[used] ?? enAbsence;
  return {
    body: renderer(input),
    locale: used,
    templateKey: ABSENCE_TEMPLATE_KEY,
  };
}
