"use client";

import { motion } from "framer-motion";
import {
  User,
  Mail,
  Building2,
  Phone,
  Shield,
  Hash,
  Briefcase,
  CalendarDays,
  GraduationCap,
  Globe,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { UserProfile } from "@/lib/types/user-profile";
import PrintDocumentHeader from "@/app/components/print/PrintDocumentHeader";
import PrintFooter from "@/app/components/print/PrintFooter";
import PrintButton from "@/app/components/forms/PrintButton";

type ProfileViewClientProps = {
  profile: UserProfile;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
  },
};

function ProfileField({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "neutral" | "amber" | "emerald" | "blue";
  delay: number;
}) {
  const toneStyles = {
    neutral: {
      iconBg: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
    },
    amber: {
      iconBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    },
    emerald: {
      iconBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    },
    blue: {
      iconBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    },
  };

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      className={cn(
        "group relative overflow-hidden rounded-md border p-5 transition-all duration-300",
        "border-slate-200 bg-white hover:shadow-md hover:border-slate-300",
        "dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneStyles[tone].iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
            {value || "—"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status, role }: { status: string | null; role: string | null }) {
  const isActive = status === "1";

  return (
    <div className="flex items-center gap-2">
      {role ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-500/20",
          )}
        >
          <Shield className="h-3 w-3" />
          {role}
        </span>
      ) : null}
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
          isActive
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-500/20"
            : "bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-500/20"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-400")} />
        {isActive ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

export default function ProfileViewClient({ profile }: ProfileViewClientProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PrintDocumentHeader
        title="Employee Profile"
        metaItems={[
          { label: "Name", value: fullName },
          { label: "Employee ID", value: profile.employeeId },
          { label: "Designation", value: profile.designation },
          { label: "Email", value: profile.emailAddress },
        ]}
      />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as const }}
        className="no-print flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Employee Profile
          </h1>

        </div>
        <div className="flex items-center gap-3">
          <PrintButton
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
            recommendedOrientation="portrait"
            documentTitle={`${fullName} — Employee Profile`}
          />
          <StatusBadge status={profile.employmentStatus} role={profile.systemRole} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] as const }}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />

        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
            <User className="h-10 w-10 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {fullName}
            </h2>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400 dark:text-slate-500">
              
              {profile.orgLevel1 ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {profile.orgLevel1}
                </span>
              ) : null}
              {profile.orgLevel2 ? (
                <>
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  <span>{profile.orgLevel2}</span>
                </>
              ) : null}
              {!profile.systemRole && !profile.orgLevel1 && !profile.orgLevel2 ? "—" : null}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <ProfileField
          icon={Hash}
          label="Employee ID"
          value={profile.employeeId || "—"}
          delay={0}
        />
       
        <ProfileField
          icon={Mail}
          label="Email Address"
          value={profile.emailAddress || "—"}
          tone="blue"
          delay={0.24}
        />

        <ProfileField
          icon={Briefcase}
          label="Designation"
          value={profile.designation || "—"}
          delay={0.4}
        />
        <ProfileField
          icon={CalendarDays}
          label="Date of Joining"
          value={profile.dateOfJoining || "—"}
          delay={0.48}
        />

        <ProfileField
          icon={GraduationCap}
          label="Qualification"
          value={profile.qualification || "—"}
          delay={0.72}
        />
        <ProfileField
          icon={CalendarDays}
          label="Qualification Year"
          value={profile.qualificationYear || "—"}
          delay={0.8}
        />
        <ProfileField
          icon={GraduationCap}
          label="Qualification Subject"
          value={profile.qualificationSubject || "—"}
          delay={0.88}
        />
        <ProfileField
          icon={Building2}
          label="Institution"
          value={profile.qualificationInstitute || "—"}
          delay={0.96}
        />
        <ProfileField
          icon={Globe}
          label="Country"
          value={profile.qualificationCountry || "—"}
          delay={1.04}
        />
        <ProfileField
          icon={Phone}
          label="Mobile Number"
          value={profile.mobileNumber || "—"}
          delay={1.12}
        />

      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="no-print text-center text-xs text-slate-400 dark:text-slate-600"
      >
        Data sourced from the PMS database. Contact HR for corrections.
      </motion.p>
      <PrintFooter />
    </div>
  );
}
