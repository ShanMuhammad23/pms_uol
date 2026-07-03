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
    <div className="space-y-6 text-text-primary">
      <div>
        <Link
          href="/dashboard/my-forms"
          className="mb-3 inline-flex items-center gap-1 text-sm text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to My Forms
        </Link>
        <h1 className="text-2xl font-bold">Complete Form</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Fill in your responses and submit when ready.
        </p>
      </div>

      <EmployeeFormFill templateId={templateId} />
    </div>
  );
}
