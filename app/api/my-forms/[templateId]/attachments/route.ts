import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import {
  addEmployeeFormAttachment,
  EmployeeFormError,
} from "@/lib/queries/employee-forms";
import { apiHandler } from "@/lib/api-handler";

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export const POST = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const userId = Number(auth.user?.id);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId: templateIdParam } = await context.params;
  const templateId = Number(templateIdParam);
  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid form id." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const questionIdRaw = formData.get("questionId");
    const file = formData.get("file");

    const questionId = Number(questionIdRaw);
    if (!questionIdRaw || Number.isNaN(questionId)) {
      return NextResponse.json(
        { error: "questionId is required." },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "file is required." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const attachment = await addEmployeeFormAttachment(
      userId,
      templateId,
      questionId,
      {
        originalFilename: file.name || "attachment",
        mimeType: file.type || null,
        bytes,
      },
    );

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof EmployeeFormError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to upload form attachment:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment." },
      { status: 500 },
    );
  }
});
