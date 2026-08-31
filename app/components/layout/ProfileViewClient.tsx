"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Globe,
  GraduationCap,
  Hash,
  Layers,
  Mail,
  Phone,
  Shield,
  UserRound,
} from "lucide-react";
import {
  containerVariants,
  itemVariants,
} from "@/app/helpers/dashboard-animations";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types/user-profile";
import PrintDocumentHeader from "@/app/components/print/PrintDocumentHeader";
import PrintFooter from "@/app/components/print/PrintFooter";
import PrintButton from "@/app/components/forms/PrintButton";

type ProfileViewClientProps = {
  profile: UserProfile;
};

function displayValue(value: string | null | undefined): string {
  if (value == null || value.trim() === "" || value === "—") return "—";
  return value.trim();
}

function isFilled(value: string | null | undefined): boolean {
  return displayValue(value) !== "—";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatJoinDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTenure(value: string | null | undefined): string | null {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  if (years === 0 && months === 0) return "Joined this month";

  const yearLabel =
    years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthLabel =
    months > 0 ? `${months} month${months === 1 ? "" : "s"}` : "";
  return [yearLabel, monthLabel].filter(Boolean).join(" ");
}

function ProfileField({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const empty = value === "—";

  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5">
        {href && !empty ? (
          <a
            href={href}
            className="break-all text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {value}
          </a>
        ) : (
          <p
            className={cn(
              "wrap-break-word text-sm font-medium",
              empty ? "text-foreground/40" : "text-text-primary",
            )}
          >
            {value}
          </p>
        )}
      </dd>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={itemVariants}
      className={cn(
        "rounded-xl border border-slate-200 bg-surface dark:border-white/10",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/10">
        <Icon
          className="size-4 text-primary"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

function StatusBadge({
  status,
  role,
  category,
}: {
  status: string | null;
  role: string | null;
  category: string | null;
}) {
  const isActive = status === "1";

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {role ? (
        <li>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            <Shield className="size-3" aria-hidden="true" />
            {role}
          </span>
        </li>
      ) : null}
      {category ? (
        <li>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold text-secondary ring-1 ring-secondary/25">
            <Layers className="size-3" aria-hidden="true" />
            {category}
          </span>
        </li>
      ) : null}
      <li>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1",
            isActive
              ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/25"
              : "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/25",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              isActive ? "bg-emerald-600 dark:bg-emerald-400" : "bg-slate-500",
            )}
            aria-hidden="true"
          />
          {isActive ? "Active" : "Inactive"}
        </span>
      </li>
    </ul>
  );
}

export default function ProfileViewClient({ profile }: ProfileViewClientProps) {
  const reduceMotion = useReducedMotion();
  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—";
  const initials = getInitials(fullName === "—" ? "" : fullName);
  const orgParts = [profile.orgLevel1, profile.orgLevel2].filter(isFilled);
  const tenure = formatTenure(profile.dateOfJoining);
  const joinDate = formatJoinDate(profile.dateOfJoining);
  const hasQualification = [
    profile.qualification,
    profile.qualificationYear,
    profile.qualificationSubject,
    profile.qualificationInstitute,
    profile.qualificationCountry,
  ].some(isFilled);

  const motionProps = reduceMotion
    ? {}
    : { variants: containerVariants, initial: "hidden" as const, animate: "visible" as const };

  const heroMotionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as const },
      };

  return (
    <div className=" space-y-6 text-text-primary">
      <PrintDocumentHeader
        title="Employee Profile"
        metaItems={[
          { label: "Name", value: fullName },
          { label: "Employee ID", value: profile.employeeId },
          { label: "Designation", value: profile.designation },
          { label: "Email", value: profile.emailAddress },
        ]}
      />

      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="mt-1 max-w-xl text-sm text-foreground/70">
            Your employment record in the Performance Management System.
          </p>
        </div>
        <PrintButton className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15" />
      </div>

      <motion.section
        {...heroMotionProps}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-surface p-5 sm:p-6 dark:border-white/10"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-20 sm:text-xl"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {fullName}
              </h2>
              <p className="text-sm font-medium text-foreground/80">
                {displayValue(profile.designation)}
              </p>
              {orgParts.length > 0 ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/60">
                  <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                  {orgParts.map((part, index) => (
                    <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                      {index > 0 ? (
                        <span className="text-foreground/30" aria-hidden="true">
                          /
                        </span>
                      ) : null}
                      <span>{part}</span>
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
          <StatusBadge
            status={profile.employmentStatus}
            role={profile.systemRole}
            category={profile.empCategory}
          />
        </div>
      </motion.section>

      <motion.div {...motionProps} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard icon={Briefcase} title="Employment">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ProfileField
              icon={Hash}
              label="Employee ID"
              value={displayValue(profile.employeeId)}
            />
            <ProfileField
              icon={Briefcase}
              label="Designation"
              value={displayValue(profile.designation)}
            />
            <ProfileField
              icon={Layers}
              label="Category"
              value={displayValue(profile.empCategory)}
            />
            <ProfileField
              icon={CalendarDays}
              label="Date of joining"
              value={joinDate}
            />
            <ProfileField
              icon={CalendarDays}
              label="Tenure"
              value={tenure ?? "—"}
            />
            <ProfileField
              icon={Building2}
              label="Organisation"
              value={orgParts.length > 0 ? orgParts.join(" / ") : "—"}
            />
          </dl>
        </SectionCard>

        <SectionCard icon={UserRound} title="Contact">
          <dl className="grid grid-cols-1 gap-5">
            <ProfileField
              icon={Mail}
              label="Email address"
              value={displayValue(profile.emailAddress)}
              href={
                isFilled(profile.emailAddress)
                  ? `mailto:${profile.emailAddress}`
                  : undefined
              }
            />
            <ProfileField
              icon={Phone}
              label="Mobile number"
              value={displayValue(profile.mobileNumber)}
              href={
                isFilled(profile.mobileNumber)
                  ? `tel:${profile.mobileNumber}`
                  : undefined
              }
            />
          </dl>
        </SectionCard>

        <SectionCard
          icon={GraduationCap}
          title="Qualification"
          className="lg:col-span-2"
        >
          {hasQualification ? (
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField
                icon={GraduationCap}
                label="Qualification"
                value={displayValue(profile.qualification)}
              />
              <ProfileField
                icon={CalendarDays}
                label="Year"
                value={displayValue(profile.qualificationYear)}
              />
              <ProfileField
                icon={GraduationCap}
                label="Subject"
                value={displayValue(profile.qualificationSubject)}
              />
              <ProfileField
                icon={Building2}
                label="Institution"
                value={displayValue(profile.qualificationInstitute)}
              />
              <ProfileField
                icon={Globe}
                label="Country"
                value={displayValue(profile.qualificationCountry)}
              />
            </dl>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center dark:border-white/15">
              <GraduationCap
                className="size-8 text-foreground/30"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-text-primary">
                No qualification on file
              </p>
              <p className="mt-1 max-w-sm text-sm text-foreground/60">
                Contact HR if your academic record should appear here.
              </p>
            </div>
          )}
        </SectionCard>
      </motion.div>

      <p className="no-print text-center text-xs text-foreground/45">
        Data sourced from the PMS database. Contact HR for corrections.
      </p>
      <PrintFooter />
    </div>
  );
}
