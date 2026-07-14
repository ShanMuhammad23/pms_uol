import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import EmployeeFormFill from "@/app/components/employee-forms/EmployeeFormFill";
import { requireSession } from "@/lib/auth/require-session";

interface MyFormDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MyFormDetailPage({ params }: MyFormDetailPageProps) {
  await requireSession();

  const { id } = await params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    notFound();
  }

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden text-text-primary">
      <Link
        href="/dashboard/my-forms"
        className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <EmployeeFormFill templateId={templateId} />
    </div>
  );
}
