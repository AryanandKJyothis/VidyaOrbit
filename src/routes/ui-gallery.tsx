import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  GreetingBanner,
  QuickActions,
  TodayAttendanceCard,
  CollectionCard,
  OverdueActionCard,
  AttendanceTrend,
  RecentActivity,
} from "@/components/app/dashboard-cards";
import { FilterChips } from "@/components/app/filter-chips";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Logo } from "@/components/logo";
import { BookOpen, CalendarDays, Clock, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/ui-gallery")({
  beforeLoad: () => {
    if (import.meta.env.PROD) throw redirect({ to: "/" });
  },
  component: UiGallery,
});

function PhoneFrame({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-elevated)]">
        <div className="px-4 py-6">{children}</div>
      </div>
    </section>
  );
}

function UiGallery() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Local preview
        </p>
        <h1 className="font-display text-3xl font-bold">Phase 3 UI gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fixture layout only. Hidden in production.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <PhoneFrame id="dash" title="Dashboard">
          <div className="space-y-3">
            <GreetingBanner
              greeting="Good morning"
              displayName="Anjali"
              instituteName="Samriddhi Centre"
              classesToday={4}
            />
            <QuickActions canViewFees canStudents canAttendance />
            <TodayAttendanceCard
              enrolled={24}
              present={18}
              absent={3}
              pending={3}
              nextBatch={{
                name: "Class 10 Mathematics",
                timing: "4:00 PM – 5:30 PM",
                students: 18,
              }}
            />
            <CollectionCard
              monthCollected={184500}
              prevMonthCollected={166000}
              collectionDeltaPct={11}
            />
            <OverdueActionCard overdueCount={4} overdueAmount={38000} />
            <AttendanceTrend
              days={[
                { label: "Thu", pct: 92 },
                { label: "Fri", pct: 94 },
                { label: "Sat", pct: 88 },
                { label: "Sun", pct: 78 },
                { label: "Today", pct: 90 },
              ]}
            />
            <RecentActivity
              items={[
                {
                  id: "1",
                  title: "Ananya R.",
                  subtitle: "Plus Two Science",
                  meta: "Present",
                  tone: "success",
                },
                {
                  id: "2",
                  title: "Vishnu K.",
                  subtitle: "Tuition fee",
                  meta: "₹2,500",
                  tone: "success",
                },
              ]}
            />
          </div>
        </PhoneFrame>

        <PhoneFrame id="students" title="Students">
          <div className="space-y-3">
            <Input
              defaultValue=""
              placeholder="Search by student name or phone"
              className="h-12 rounded-2xl"
            />
            <FilterChips
              ariaLabel="Batches"
              value="all"
              onChange={() => {}}
              chips={[
                { id: "all", label: "All batches", count: 4 },
                { id: "10", label: "Class 10 State", count: 2 },
              ]}
            />
            <ul className="space-y-3">
              {[
                {
                  name: "Aadhavan Nair",
                  batch: "Class 10 State · Maths",
                  status: "Paid",
                  ok: true,
                },
                {
                  name: "Devika Krishna",
                  batch: "Plus Two Science",
                  status: "Overdue ₹3,500",
                  ok: false,
                },
              ].map((s) => (
                <li
                  key={s.name}
                  className="rounded-2xl border border-border/80 bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.batch}</p>
                      <span
                        className={`mt-2 pill ${s.ok ? "pill-success" : "pill-danger"}`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </PhoneFrame>

        <PhoneFrame id="attendance" title="Attendance">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-success/12 py-3 text-center">
              <p className="text-xs font-semibold text-success">Present</p>
              <p className="font-display text-2xl font-bold">18</p>
            </div>
            <div className="rounded-2xl bg-destructive/12 py-3 text-center">
              <p className="text-xs font-semibold text-destructive">Absent</p>
              <p className="font-display text-2xl font-bold">3</p>
            </div>
            <div className="rounded-2xl bg-muted py-3 text-center">
              <p className="text-xs font-semibold text-muted-foreground">
                Unmarked
              </p>
              <p className="font-display text-2xl font-bold">3</p>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {["Aadhavan Nair", "Ananya Pillai", "Devika Krishna"].map(
              (name, i) => (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3"
                >
                  <span className="w-6 text-xs font-semibold text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <InitialsAvatar name={name} />
                  <span className="flex-1 text-sm font-semibold">{name}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-success bg-success/10 text-sm font-bold text-success">
                    P
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold text-muted-foreground">
                    A
                  </span>
                </li>
              ),
            )}
          </ul>
          <Button className="mt-4 h-12 w-full">
            Save attendance (18 Present, 3 Absent)
          </Button>
        </PhoneFrame>

        <PhoneFrame id="fees" title="Fees">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-4">
              <p className="type-kicker text-primary-foreground/80">
                This month
              </p>
              <p className="font-display text-3xl font-bold">₹1,84,500</p>
              <Button className="mt-4 h-11 w-full bg-card text-foreground">
                <Plus className="h-4 w-4" /> Record payment
              </Button>
            </CardContent>
          </Card>
        </PhoneFrame>

        <PhoneFrame id="batches" title="Batches">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mathematics</p>
                  <h3 className="font-display font-semibold">
                    Class 10 · Mathematics
                  </h3>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> Mon, Wed, Fri
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> 4:00 PM – 5:30 PM
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> 18 learners
              </p>
            </CardContent>
          </Card>
        </PhoneFrame>

        <PhoneFrame id="staff" title="Staff">
          <ul className="space-y-3">
            {[
              { name: "Centre owner", role: "Owner", status: "Active" },
              { name: "Batch tutor", role: "Staff", status: "Invited" },
            ].map((row) => (
              <li
                key={row.name}
                className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4"
              >
                <InitialsAvatar name={row.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.role}</p>
                </div>
                <span className="pill pill-success">{row.status}</span>
              </li>
            ))}
          </ul>
        </PhoneFrame>

        <PhoneFrame id="settings" title="Settings">
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="type-kicker text-muted-foreground">
                Centre profile
              </p>
              <div className="space-y-1.5">
                <Label>Institute name</Label>
                <Input defaultValue="Samriddhi Centre" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input defaultValue="hello@centre.example" className="h-11" />
              </div>
              <Button className="h-11 w-full" variant="outline">
                Save profile
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-3">
            <CardContent className="p-5">
              <p className="type-kicker text-muted-foreground">
                Your current plan
              </p>
              <p className="mt-1 font-display text-lg font-semibold">Starter</p>
              <p className="text-xs text-muted-foreground">Active</p>
              <Button className="mt-3 h-11 w-full" variant="outline">
                Manage plan
              </Button>
            </CardContent>
          </Card>
        </PhoneFrame>

        <PhoneFrame id="login-card" title="Login">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
                <Logo size={26} />
              </div>
              <span className="font-display text-2xl font-bold">
                vidya<span className="text-primary">orbit</span>
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">
              Manage your tuition centre with ease
            </h2>
            <div className="mt-4 w-full space-y-3 text-left">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input defaultValue="hello@centre.example" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  defaultValue="password"
                  className="h-11"
                />
              </div>
              <Button className="h-12 w-full">Sign in to Vidya Orbit</Button>
            </div>
          </div>
        </PhoneFrame>

        <PhoneFrame id="states" title="Empty, loading, disabled">
          <div className="space-y-4">
            <EmptyState
              icon={Users}
              title="No students yet"
              description="Add learners manually or import a spreadsheet."
            >
              <Button>Add student</Button>
              <Button variant="outline">Import spreadsheet</Button>
            </EmptyState>
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
            <Button className="h-12 w-full" disabled>
              Save attendance
            </Button>
          </div>
        </PhoneFrame>
      </div>
    </main>
  );
}
