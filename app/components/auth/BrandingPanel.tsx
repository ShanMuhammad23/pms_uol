import { BarChart3, Sparkles, UsersRound } from "lucide-react";
import Image from "next/image";
const highlights = [
  {
    title: "Align goals with strategy",
    description: "Track team and individual performance against organizational priorities.",
    icon: BarChart3,
  },
  {
    title: "Grow future leaders",
    description: "Build succession pipelines with clear skill development milestones.",
    icon: UsersRound,
  },
  {
    title: "Reward high impact",
    description: "Use fair, data-driven evaluations to recognize top contributors.",
    icon: Sparkles,
  },
];

export function BrandingPanel() {
  return (
    <aside className="relative hidden w-1/2 overflow-hidden bg-[#0F2C59] p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(224,122,95,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(224,122,95,0.25)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      <div className="relative max-w-md space-y-4">
       <Image src="/logo.png" alt="logo" width={200} height={100}/>
        <h1 className="text-4xl font-bold leading-tight">
          Performance Management System
        </h1>
        <p className="text-base text-slate-200">
          Empower managers and teams with transparent goals, fair reviews, and
          succession insight in one unified platform.
        </p>
      </div>

      <div className="relative mt-8 grid gap-4">
        {highlights.map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
          >
            <div className="mb-2 inline-flex rounded-md bg-[#E07A5F]/20 p-2 text-[#E07A5F]">
              <Icon aria-hidden="true" className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-200">{description}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}
