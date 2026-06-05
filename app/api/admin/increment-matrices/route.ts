import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  getIncrementMatricesByCycleId,
  upsertIncrementMatrices,
} from "@/lib/queries/increment-matrices";
import type { IncrementMatrixInput } from "@/types/forms";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const cycleId = Number(searchParams.get("cycleId"));

  if (Number.isNaN(cycleId)) {
    return NextResponse.json({ error: "cycleId is required." }, { status: 400 });
  }

  try {
    const matrices = await getIncrementMatricesByCycleId(cycleId);
    return NextResponse.json(matrices);
  } catch (error) {
    console.error("Failed to load increment matrices:", error);
    return NextResponse.json(
      { error: "Failed to load increment matrices." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      cycleId: number;
      matrices: IncrementMatrixInput[];
    };

    if (!body.cycleId || Number.isNaN(Number(body.cycleId))) {
      return NextResponse.json({ error: "cycleId is required." }, { status: 400 });
    }

    if (!body.matrices || body.matrices.length === 0) {
      return NextResponse.json(
        { error: "Increment matrix entries are required." },
        { status: 400 },
      );
    }

    await upsertIncrementMatrices(body.cycleId, body.matrices);
    const matrices = await getIncrementMatricesByCycleId(body.cycleId);
    return NextResponse.json(matrices);
  } catch (error) {
    console.error("Failed to update increment matrices:", error);
    return NextResponse.json(
      { error: "Failed to update increment matrices." },
      { status: 500 },
    );
  }
}
