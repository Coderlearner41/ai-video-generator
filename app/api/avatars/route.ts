import { NextResponse } from "next/server"

export async function GET() {
  const API_KEY = process.env.NEXT_PUBLIC_HEYGEN_KEY
  const url = "https://api.heygen.com/v2/avatars"

  console.log("🌐 Fetching avatars from Heygen API (server-side)...")

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": API_KEY!,
      },
      cache: "no-store",
    })

    console.log("📡 Heygen API response status:", res.status)

    const data = await res.json()

    // ✅ Check nested data path
    const avatarsList = data?.data?.avatars
    if (!avatarsList || !Array.isArray(avatarsList)) {
      console.warn("⚠️ Unexpected API response structure:", data)
      return NextResponse.json({ error: "No avatars found" }, { status: 500 })
    }

    // ✅ Take first 15 avatars
    const avatars = avatarsList.slice(0, 15).map((a: any) => ({
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name,
        gender: a.gender,
        preview_image_url: a.preview_image_url,
        preview_video_url: a.preview_video_url,
        premium: a.premium,
      }))
      
    console.log(`✅ Returning ${avatars.length} avatars.`)
    return NextResponse.json({ avatars })
  } catch (err) {
    console.error("❌ Error fetching avatars:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
