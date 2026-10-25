import { describe, expect, it } from "vitest";
import {
  absenteeSentKey,
  buildAbsenteeMessage,
  canMessageAbsentees,
  groupTodaysAbsentees,
  markAbsenteeSent,
} from "./absentees";

describe("today's absentees", () => {
  it("groups today's absent marks by batch and skips archived students", () => {
    const groups = groupTodaysAbsentees({
      today: "2026-10-15",
      batches: [
        { id: "b1", name: "Class 10 Maths" },
        { id: "b2", name: "Class 8 Science" },
      ],
      students: [
        {
          id: "s1",
          full_name: "Amina",
          batch_id: "b1",
          guardian_phone: "9876543210",
          phone: null,
          status: "active",
        },
        {
          id: "s2",
          full_name: "Rahul",
          batch_id: "b2",
          guardian_phone: null,
          phone: "9123456789",
          status: "active",
        },
        {
          id: "s3",
          full_name: "Old student",
          batch_id: "b1",
          guardian_phone: "9000000000",
          phone: null,
          status: "archived",
        },
        {
          id: "s4",
          full_name: "Present kid",
          batch_id: "b1",
          guardian_phone: "9111111111",
          phone: null,
          status: "active",
        },
      ],
      records: [
        {
          student_id: "s1",
          status: "absent",
          session_date: "2026-10-15",
          batch_id: "b1",
        },
        {
          student_id: "s2",
          status: "absent",
          session_date: "2026-10-15",
          batch_id: "b2",
        },
        {
          student_id: "s3",
          status: "absent",
          session_date: "2026-10-15",
          batch_id: "b1",
        },
        {
          student_id: "s4",
          status: "present",
          session_date: "2026-10-15",
          batch_id: "b1",
        },
        {
          student_id: "s1",
          status: "absent",
          session_date: "2026-10-14",
          batch_id: "b1",
        },
      ],
    });
    expect(groups.map((g) => g.batchName)).toEqual([
      "Class 10 Maths",
      "Class 8 Science",
    ]);
    expect(groups[0]?.students.map((s) => s.studentName)).toEqual(["Amina"]);
    expect(groups[1]?.students.map((s) => s.studentName)).toEqual(["Rahul"]);
  });

  it("prefills a parent WhatsApp draft from the centre's own chat", () => {
    const share = buildAbsenteeMessage({
      studentName: "Amina",
      centreName: "Orbit Coaching",
      sessionDate: "2026-10-15",
      batchName: "Class 10 Maths",
      guardianPhone: "9876543210",
    });
    expect(share.message).toBe(
      "Dear parent, Amina was absent today (15 Oct 2026, Class 10 Maths) at Orbit Coaching. Please contact us if this is unexpected.",
    );
    expect(share.href).toContain("https://wa.me/919876543210?text=");
  });

  it("tracks a sent tick locally per student and day", () => {
    const key = absenteeSentKey("s1", "2026-10-15");
    const sent = markAbsenteeSent(new Set(), "s1", "2026-10-15");
    expect(sent.has(key)).toBe(true);
    expect(canMessageAbsentees("write")).toBe(true);
    expect(canMessageAbsentees("read")).toBe(false);
  });
});
