import {
  deriveGettingStarted,
  EMPTY_OWNER_SETUP_DRAFT,
  type OwnerSetupDraft,
  type WizardStepId,
} from "@/lib/owner-onboarding";

export const FIXTURE_WIZARD_DRAFT: OwnerSetupDraft = {
  ...EMPTY_OWNER_SETUP_DRAFT,
  ownerName: "Anjali Krishnan",
  name: "Samriddhi Centre",
  contactPhone: "9876543210",
  address: "Near Civil Station, Kottayam",
  centreType: "tuition",
  upiVpa: "samriddhi@oksbi",
  batchName: "Class 10 Mathematics",
  batchTiming: "4:00 PM – 5:30 PM",
  studentName: "Anjali Krishnan",
  studentPhone: "9895123456",
};

export const FIXTURE_WIZARD_STEPS: WizardStepId[] = [
  "you",
  "profile",
  "batch",
  "students",
];

export const FIXTURE_STAFF_DRAFT: OwnerSetupDraft = {
  ...EMPTY_OWNER_SETUP_DRAFT,
  ownerName: "Ravi Menon",
  contactPhone: "9876501234",
};

export const FIXTURE_CHECKLIST_PARTIAL = deriveGettingStarted({
  batchCount: 1,
  activeStudentCount: 0,
  paymentCount: 0,
  attendanceStarted: false,
});
