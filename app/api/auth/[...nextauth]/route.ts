import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/auth";

const handler = NextAuth(authOptions);

type RouteContext = {
  params: Promise<{ nextauth?: string[] }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  return handler(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handler(req, context);
}
