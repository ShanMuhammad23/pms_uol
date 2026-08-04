import { createReadStream } from "fs";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import { requireSessionApi } from "@/lib/auth/require-session";
import {
  deleteEmployeeFormAttachment,
  EmployeeFormError,
  getEmployeeFormAttachmentForDownload,
} from "@/lib/queries/employee-forms";

interface RouteContext {
  params: Promise<{ templateId: string; attachmentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const userId = Number(auth.user?.id);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId: templateIdParam, attachmentId: attachmentIdParam } =
    await context.params;
  const templateId = Number(templateIdParam);
  const attachmentId = Number(attachmentIdParam);

  if (Number.isNaN(templateId) || Number.isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const file = await getEmployeeFormAttachmentForDownload(
      userId,
      templateId,
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
    if (error instanceof EmployeeFormError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to download form attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const userId = Number(auth.user?.id);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId: templateIdParam, attachmentId: attachmentIdParam } =
    await context.params;
  const templateId = Number(templateIdParam);
  const attachmentId = Number(attachmentIdParam);

  if (Number.isNaN(templateId) || Number.isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await deleteEmployeeFormAttachment(userId, templateId, attachmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EmployeeFormError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete form attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment." },
      { status: 500 },
    );
  }
}
