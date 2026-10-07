import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { toGifs, type GiphyResponse } from "@/lib/giphy";

/**
 * GIF search for messages, through our server: the GIPHY key stays secret, searches carry no
 * personal data, and only G-rated GIFs come back (many people here are minors).
 * Set GIPHY_API_KEY (developers.giphy.com, free) in the Vercel project to switch it on.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (session.status !== "active") return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ error: "not-configured" }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 50);
  const offset = Math.min(Math.max(Number(params.get("offset")) || 0, 0), 200);
  const lang = params.get("lang") === "en" ? "en" : "ro";
  const endpoint = new URL(q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending");
  endpoint.search = new URLSearchParams({ api_key: key, limit: "24", offset: String(offset), rating: "g", ...(q ? { q, lang } : {}) }).toString();

  try {
    const response = await fetch(endpoint, { next: { revalidate: 300 } });
    if (!response.ok) return NextResponse.json({ error: "giphy" }, { status: 502 });
    return NextResponse.json({ gifs: toGifs((await response.json()) as GiphyResponse) });
  } catch {
    return NextResponse.json({ error: "giphy" }, { status: 502 });
  }
}
