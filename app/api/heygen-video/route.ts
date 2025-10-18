import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    // console.log(req)
    const body = await req.json()
    console.log("📦 Sending body:", JSON.stringify(body, null, 2))
    const HEYGEN_API_KEY = process.env.NEXT_PUBLIC_HEYGEN_KEY // ✅ Use server-side env var

    if (!HEYGEN_API_KEY) {
      return NextResponse.json({ error: "Missing HeyGen API key" }, { status: 400 })
    }

    console.log("🎬 Sending video generation request to HeyGen...")

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    console.log(res)

    const text = await res.text()
    console.log("🎥 HeyGen generate response:", text)

    if (!res.ok) {
      return NextResponse.json(
        { error: "HeyGen generate failed", details: text },
        { status: res.status },

      )
    }

    // ✅ Return parsed JSON for easier handling on client
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    console.error("❌ HeyGen generate error:", err)
    return NextResponse.json(
      { error: "Failed to generate video", details: err.message },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get("id")
    const HEYGEN_API_KEY = process.env.NEXT_PUBLIC_HEYGEN_KEY

    if (!videoId) {
      return NextResponse.json({ error: "Missing video ID" }, { status: 400 })
    }
    if (!HEYGEN_API_KEY) {
      return NextResponse.json({ error: "Missing HeyGen API key" }, { status: 400 })
    }

    console.log(`📡 Checking status for video ID: ${videoId}`)

    const res = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "X-Api-key": HEYGEN_API_KEY,
        },
      }
    )

    const text = await res.text()
    console.log("📡 HeyGen status response:", text)

    if (!res.ok) {
      return NextResponse.json(
        { error: "HeyGen status failed", details: text },
        { status: res.status }
      )
    }

    // ✅ Return parsed JSON for easy use in client
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    console.error("❌ HeyGen status error:", err)
    return NextResponse.json(
      { error: "Failed to fetch status", details: err.message },
      { status: 500 }
    )
  }
}
