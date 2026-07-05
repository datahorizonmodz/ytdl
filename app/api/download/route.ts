import { NextResponse } from "next/server";
import { downr } from "@/lib/downr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url")?.trim();

    if (!url) {
      return json({ Status: false, Error: "URL is required" }, 400);
    }

    const result = await downr(url);
    return json(result, result.Status ? 200 : 502);
  } catch (error) {
    return json(
      {
        Status: false,
        Error: error instanceof Error ? error.message : "Failed to process request",
      },
      500,
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return json({ Status: false, Error: "URL is required" }, 400);
    }

    const result = await downr(url);
    return json(result, result.Status ? 200 : 502);
  } catch (error) {
    return json(
      {
        Status: false,
        Error: error instanceof Error ? error.message : "Failed to process request",
      },
      500,
    );
  }
}
