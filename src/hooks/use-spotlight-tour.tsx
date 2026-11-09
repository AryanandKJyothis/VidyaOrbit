import { useState, useEffect } from "react";
import type { SpotlightStep } from "@/components/spotlight-tour";

const TOUR_SEEN_KEY = "vidya:tour-seen";
const TOUR_SKIPPED_KEY = "vidya:tour-skipped";

export function useSpotlightTour() {
  const [shouldShowTour, setShouldShowTour] = useState(false);
  const [isReplay, setIsReplay] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(TOUR_SEEN_KEY) === "true";
      const skipped = localStorage.getItem(TOUR_SKIPPED_KEY) === "true";

      // Show tour if user hasn't seen or completed it
      if (!seen && !skipped) {
        // Small delay to let the page settle
        const timer = setTimeout(() => setShouldShowTour(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const startTour = () => {
    setIsReplay(true);
    setShouldShowTour(true);
  };

  const completeTour = () => {
    setShouldShowTour(false);
    setIsReplay(false);
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
      localStorage.removeItem(TOUR_SKIPPED_KEY);
    } catch {
      // ignore
    }
  };

  const skipTour = () => {
    setShouldShowTour(false);
    setIsReplay(false);
    try {
      if (!isReplay) {
        // Only mark as skipped if it's the first-run tour
        localStorage.setItem(TOUR_SKIPPED_KEY, "true");
      }
    } catch {
      // ignore
    }
  };

  return {
    shouldShowTour,
    startTour,
    completeTour,
    skipTour,
  };
}

/**
 * Define the onboarding tour steps.
 * These follow the natural flow: create batch → add students → mark attendance → record fee → view dues
 */
export function getOnboardingSteps(): SpotlightStep[] {
  return [
    {
      id: "create-batch",
      target: '[data-tour="create-batch"]',
      title: "Start with a batch",
      content:
        "Create your first batch — like 'Class 10 Morning' or 'Science Batch A'. Students are organized by batch for attendance and fees.",
      placement: "auto",
    },
    {
      id: "add-students",
      target: '[data-tour="add-student"]',
      title: "Add your students",
      content:
        "Import from Excel or add one by one. You'll need their names and at least one phone number for receipts.",
      placement: "auto",
    },
    {
      id: "mark-attendance",
      target: '[data-tour="mark-attendance"]',
      title: "Mark attendance",
      content:
        "Take attendance by batch. Tap Present, Late or Absent for each student. Your marks save instantly.",
      placement: "auto",
    },
    {
      id: "record-fee",
      target: '[data-tour="record-payment"]',
      title: "Record payments",
      content:
        "When students pay, record it here. Cash or UPI — you'll get a numbered receipt to share on WhatsApp.",
      placement: "auto",
    },
    {
      id: "view-dues",
      target: '[data-tour="view-dues"]',
      title: "Track what's due",
      content:
        "See everyone who owes at a glance. Filter by overdue, and send reminders from your phone when needed.",
      placement: "auto",
    },
  ];
}

/**
 * Check if the current page/state should show a specific tour step.
 * This helps ensure we only show steps when their targets are actually visible.
 */
export function shouldShowTourOnPage(pathname: string): boolean {
  // Show tour on dashboard (where we have Quick Actions)
  // or on the specific feature pages
  const tourPages = [
    "/dashboard",
    "/batches",
    "/students",
    "/attendance",
    "/fees",
  ];
  return tourPages.some((page) => pathname === page);
}
