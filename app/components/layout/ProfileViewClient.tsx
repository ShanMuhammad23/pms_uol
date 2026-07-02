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
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { UserProfile } from "@/lib/types/user-profile";

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
        "group relative overflow-hidden rounded-xl border p-5 transition-all duration-300",
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

function StatusBadge({ status }: { status: string | null }) {
  const isActive = status === "1";

  return (
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
  );
}

export default function ProfileViewClient({ profile }: ProfileViewClientProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as const }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Employee Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            PMS employee record — university employment data
          </p>
        </div>
        <StatusBadge status={profile.employmentStatus} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] as const }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />

        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
            <User className="h-10 w-10 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {fullName}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {profile.designation || "—"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {profile.entity || "—"}
            </p>
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
          icon={User}
          label="First Name"
          value={profile.firstName || "—"}
          delay={0.08}
        />
        <ProfileField
          icon={User}
          label="Last Name"
          value={profile.lastName || "—"}
          delay={0.16}
        />
        <ProfileField
          icon={Mail}
          label="Email Address"
          value={profile.emailAddress || "—"}
          tone="blue"
          delay={0.24}
        />
        <ProfileField
          icon={Building2}
          label="Entity"
          value={profile.entity || "—"}
          delay={0.32}
        />
        <ProfileField
          icon={Briefcase}
          label="Designation"
          value={profile.designation || "—"}
          delay={0.4}
        />
        <ProfileField
          icon={Shield}
          label="System Role"
          value={profile.systemRole || "—"}
          tone="amber"
          delay={0.48}
        />
        <ProfileField
          icon={Briefcase}
          label="Employee Category"
          value={profile.empCategory || "—"}
          delay={0.56}
        />
        <ProfileField
          icon={Phone}
          label="Mobile Number"
          value={profile.mobileNumber || "—"}
          delay={0.64}
        />
        <ProfileField
          icon={Shield}
          label="Employment Status"
          value={profile.employmentStatus === "1" ? "Active" : "Inactive"}
          tone={profile.employmentStatus === "1" ? "emerald" : "neutral"}
          delay={0.72}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center text-xs text-slate-400 dark:text-slate-600"
      >
        Data sourced from the PMS database. Contact HR for corrections.
      </motion.p>
    </div>
  );
}
