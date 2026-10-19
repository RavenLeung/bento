import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { toStaffOrder } from "@/lib/serializers";
import { markOrderPickedUpForStaff } from "@/lib/services/staff";
import { AppError } from "@/lib/types";

const idSchema = z.string().uuid();

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getStaffSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const result = await markOrderPickedUpForStaff(idSchema.parse(id));
    return NextResponse.json({
      order: toStaffOrder(result.order),
      squareSynced: result.squareSynced,
      warning: result.warning
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to update the order." }, { status: 500 });
  }
}
