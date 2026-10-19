import { NextResponse } from "next/server";
import { z } from "zod";
import { checkout } from "@/lib/services/checkout";
import { AppError } from "@/lib/types";

const schema = z.object({
  quoteToken: z.string().min(20),
  paymentToken: z.string().min(1),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.string().trim().email().max(180),
  pickupAt: z.string().datetime(),
  allergenAcknowledged: z.literal(true),
  idempotencyKey: z.string().uuid(),
  paymentAttemptKey: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const order = await checkout(input);
    return NextResponse.json({
      orderToken: order.publicToken,
      orderCode: order.orderCode,
      status: order.status,
      pickupAt: order.pickupAt,
      totalCents: order.totalCents,
      currency: order.currency
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: "BAD_REQUEST", error: "Check your details and try again.", details: error.issues },
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
      {
        code: "INTERNAL_ERROR",
        error: "We could not complete checkout. Please try again or ask the team for help."
      },
      { status: 500 }
    );
  }
}
