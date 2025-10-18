import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    // 'handleUpload' is a helper from @vercel/blob that does all the work.
    // It generates a secure, one-time upload URL and returns the final file info.
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // This is where you can add security rules.
        // We'll allow 'video/mp4' for our sample video.
        return {
          allowedContentTypes: ['video/mp4'],
          tokenPayload: JSON.stringify({
            // You could pass metadata here if needed
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This code runs *after* the file is successfully uploaded.
        console.log('✅ Vercel Blob upload complete', blob.url);
      },
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