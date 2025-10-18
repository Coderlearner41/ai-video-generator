import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Allow video, image, and audio uploads
        return {
          allowedContentTypes: ['video/mp4', 'image/png', 'audio/mpeg'], // Added image/png and audio/mpeg
          tokenPayload: JSON.stringify({
            // Optional metadata
          }),
        };
      },
      // Removed onUploadCompleted as it's not needed
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("❌ Vercel Blob upload error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}