import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody & { filename?: string; file?: any };

    // 🧩 Optional: custom overwrite trigger
    const maybeFileName =
      (body as any)?.filename || (body as any)?.name || (body as any)?.pathname;

    if (typeof maybeFileName === "string" && maybeFileName.includes("_overwrite")) {
      console.log("🔁 Overwriting existing blob:", maybeFileName);

      // convert to safe filename
      const cleanName = maybeFileName.replace("_overwrite", "");

      // Read uploaded file content — only works if sent in base64 or similar
      if (!body.file) {
        return NextResponse.json(
          { error: "Missing file for overwrite." },
          { status: 400 }
        );
      }

      const blob = await put(cleanName, body.file, {
        access: "public",
        allowOverwrite: true, // ✅ only works server-side
      });

      return NextResponse.json(blob);
    }

    // 🧠 Default: normal token-based upload for client-side upload()
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        return {
          allowedContentTypes: ["video/mp4", "image/png", "audio/mpeg"],
          tokenPayload: JSON.stringify({
            // You can store metadata here if needed
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
