import { NextResponse } from "next/server";
import { z } from "zod";
import { createQuote } from "@/lib/services/checkout";
import { AppError } from "@/lib/types";

const schema = z.object({
  boxItemId: z.string().min(1),
  selections: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().positive().max(20)
      })
    )
    .max(40)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await createQuote(input));
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Invalid request.", details: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { code: error.code, error: error.message, details: error.details },
      { status: error.status }
    );
  }
  console.error(error);
  return NextResponse.json(
    { code: "INTERNAL_ERROR", error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
