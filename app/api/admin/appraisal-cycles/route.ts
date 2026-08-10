import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  createAppraisalCycle,
  listAppraisalCycles,
} from "@/lib/queries/appraisal-cycles";
import type { CreateAppraisalCycleInput } from "@/types/forms";

export async function GET() {
  const auth = await requireModuleViewApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const cycles = await listAppraisalCycles();
    return NextResponse.json(cycles);
  } catch (error) {
    console.error("Failed to list appraisal cycles:", error);
    return NextResponse.json(
      { error: "Failed to load appraisal cycles." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as CreateAppraisalCycleInput;

    if (!body.fiscalYear || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Fiscal year, start date, and end date are required." },
        { status: 400 },
      );
    }

    const cycle = await createAppraisalCycle(body);
    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    console.error("Failed to create appraisal cycle:", error);

    const message =
      error instanceof Error && error.message.includes("unique")
        ? "An appraisal cycle for this fiscal year already exists."
        : "Failed to create appraisal cycle.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
