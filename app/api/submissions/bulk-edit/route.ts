import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  bulkUpdateEmployeeListingFields,
} from "@/lib/queries/form-submissions";
import { canEditModule } from "@/lib/auth/additional-access";
import type { AdditionalAccessModule } from "@/types/additional-access";
import { USER_ROLES } from "@/types/users";

function parseOptionalTextField(
  body: Record<string, unknown>,
  key: string,
): { provided: boolean; value: string | null } {
  if (!(key in body)) {
    return { provided: false, value: null };
  }

  const raw = body[key];
  if (raw !== null && typeof raw !== "string") {
    throw new FormSubmissionError(`${key} must be a string or null.`, 400);
  }

  return {
    provided: true,
    value: typeof raw === "string" ? raw.trim() || null : null,
  };
}

function parseOptionalNumberField(
  body: Record<string, unknown>,
  key: string,
): { provided: boolean; value: number | null } {
  if (!(key in body)) {
    return { provided: false, value: null };
  }

  const raw = body[key];
  if (raw === null) {
    return { provided: true, value: null };
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new FormSubmissionError(`${key} must be a number or null.`, 400);
  }

  return { provided: true, value: raw };
}

export async function PATCH(request: Request) {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds must be a non-empty array." },
        { status: 400 },
      );
    }

    if (
      !body.employeeIds.every(
        (id) => typeof id === "string" && id.trim().length > 0,
      )
    ) {
      return NextResponse.json(
        { error: "Each employeeId must be a non-empty string." },
        { status: 400 },
      );
    }

    const roleCategory = parseOptionalTextField(body, "roleCategory");
    const designation = parseOptionalTextField(body, "designation");
    const entityId = parseOptionalNumberField(body, "entityId");
    const templateId = parseOptionalNumberField(body, "templateId");
    const qualification = parseOptionalTextField(body, "qualification");
    const qualificationYear = parseOptionalNumberField(body, "qualificationYear");
    const qualificationSubject = parseOptionalTextField(body, "qualificationSubject");
    const qualificationInstitute = parseOptionalTextField(body, "qualificationInstitute");
    const qualificationCountry = parseOptionalTextField(body, "qualificationCountry");
    const creditHrsErpScoreAdj = parseOptionalNumberField(body, "creditHrsErpScoreAdj");
    const pubOricScoreAdj = parseOptionalNumberField(body, "pubOricScoreAdj");
    const qecScoreAdj = parseOptionalNumberField(body, "qecScoreAdj");
    const calibrationFactor = parseOptionalNumberField(body, "calibrationFactor");
    const manager1UserId = parseOptionalNumberField(body, "manager1UserId");
    const manager2UserId = parseOptionalNumberField(body, "manager2UserId");
    const assessmentEligibility =
      "assessmentEligibility" in body
        ? { provided: true as const, value: body.assessmentEligibility as boolean }
        : { provided: false as const, value: null };

    if (
      assessmentEligibility.provided &&
      typeof assessmentEligibility.value !== "boolean"
    ) {
      return NextResponse.json(
        { error: "assessmentEligibility must be a boolean." },
        { status: 400 },
      );
    }

    const systemRole =
      "systemRole" in body
        ? { provided: true as const, value: body.systemRole as string | null }
        : { provided: false as const, value: null };

    if (
      systemRole.provided &&
      systemRole.value !== null &&
      !USER_ROLES.includes(systemRole.value as typeof USER_ROLES[number])
    ) {
      return NextResponse.json(
        { error: `systemRole must be one of: ${USER_ROLES.join(", ")}.` },
        { status: 400 },
      );
    }

    const fields: Record<string, unknown> = {};

    if (roleCategory.provided) fields.roleCategory = roleCategory.value;
    if (designation.provided) fields.designation = designation.value;
    if (entityId.provided) fields.entityId = entityId.value;
    if (templateId.provided) fields.templateId = templateId.value;
    if (qualification.provided) fields.qualification = qualification.value;
    if (qualificationYear.provided) fields.qualificationYear = qualificationYear.value;
    if (qualificationSubject.provided) fields.qualificationSubject = qualificationSubject.value;
    if (qualificationInstitute.provided) fields.qualificationInstitute = qualificationInstitute.value;
    if (qualificationCountry.provided) fields.qualificationCountry = qualificationCountry.value;
    if (creditHrsErpScoreAdj.provided) fields.creditHrsErpScoreAdj = creditHrsErpScoreAdj.value;
    if (pubOricScoreAdj.provided) fields.pubOricScoreAdj = pubOricScoreAdj.value;
    if (qecScoreAdj.provided) fields.qecScoreAdj = qecScoreAdj.value;
    if (calibrationFactor.provided) fields.calibrationFactor = calibrationFactor.value;
    if (manager1UserId.provided) fields.manager1UserId = manager1UserId.value;
    if (manager2UserId.provided) fields.manager2UserId = manager2UserId.value;
    if (assessmentEligibility.provided) fields.assessmentEligibility = assessmentEligibility.value;
    if (systemRole.provided) fields.systemRole = systemRole.value;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update." },
        { status: 400 },
      );
    }

    // Additional-access checks for score adjustment fields.
    // Admin roles (SUPER_ADMIN, HR, BOARD) pass via RBAC through requireSubmissionReviewerApi.
    // Non-admin users with additional-access EDIT permission on the mapped module can also edit.
    const SCORE_ADJ_MODULE_MAP: Record<string, AdditionalAccessModule> = {
      creditHrsErpScoreAdj: "CREDIT_HOURS",
      pubOricScoreAdj: "ORIC_ADJUSTMENTS",
      qecScoreAdj: "QEC_ADJUSTMENTS",
    };

    const isAdmin = ["SUPER_ADMIN", "HR", "BOARD"].includes(
      auth.user?.role ?? "",
    );

    if (!isAdmin) {
      for (const [fieldName, moduleName] of Object.entries(
        SCORE_ADJ_MODULE_MAP,
      )) {
        if (fieldName in fields) {
          const allowed = await canEditModule(
            Number(auth.user?.id),
            moduleName,
            auth.user?.role,
          );
          if (!allowed) {
            return NextResponse.json(
              { error: `Forbidden: edit access required for ${moduleName}.` },
              { status: 403 },
            );
          }
        }
      }
    }

    const updated = await bulkUpdateEmployeeListingFields(
      body.employeeIds as string[],
      fields,
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to bulk edit staff listing fields:", error);
    return NextResponse.json(
      { error: "Failed to bulk edit staff." },
      { status: 500 },
    );
  }
}
