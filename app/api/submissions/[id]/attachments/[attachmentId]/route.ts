import { createReadStream } from "fs";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import {
  EmployeeFormError,
  getSubmissionAttachmentForDownload,
} from "@/lib/queries/employee-forms";
import { getFormSubmissionSummaryById } from "@/lib/queries/form-submissions";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: idParam, attachmentId: attachmentIdParam } = await context.params;
  const submissionId = Number(idParam);
  const attachmentId = Number(attachmentIdParam);

  if (Number.isNaN(submissionId) || Number.isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const summary = await getFormSubmissionSummaryById(submissionId);
    if (!summary) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 },
      );
    }

    // Reuse the same RBAC as the submission detail view: any role authorised
    // to open the submission may download its attachments.
    await assertSubmissionAccessible(auth, summary);

    const file = await getSubmissionAttachmentForDownload(
      submissionId,
      attachmentId,
    );

    const nodeStream = createReadStream(file.absolutePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalFilename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof SubmissionAccessError) {
      return submissionAccessErrorResponse(error);
    }

    if (error instanceof EmployeeFormError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to download submission attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment." },
      { status: 500 },
    );
  }
}
