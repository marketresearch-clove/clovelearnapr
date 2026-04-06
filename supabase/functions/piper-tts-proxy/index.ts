/**
 * Supabase Edge Function: Piper TTS Proxy
 * 
 * This Edge Function acts as a secure proxy to Piper TTS server.
 * Useful for production deployments where you want to:
 * - Route all TTS through Supabase
 * - Apply authentication/rate limiting
 * - Use as fallback to multiple Piper instances
 * 
 * Deploy: supabase functions deploy piper-tts-proxy
 * Call: https://[project].supabase.co/functions/v1/piper-tts-proxy
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface TTSRequest {
    text: string;
    speaker?: string;
    lengthScale?: number;
}

interface TTSResponse {
    success: boolean;
    audioUrl?: string;
    duration?: number;
    error?: string;
    provider?: string;
}

/**
 * Main handler for TTS requests
 */
Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    // Only allow POST
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        // Get Piper URL from environment
        const piperUrl =
            Deno.env.get("PIPER_API_URL") || "http://localhost:5002";

        console.log(`[Piper Proxy] Forwarding request to ${piperUrl}`);

        // Parse request
        const body = await req.json() as TTSRequest;

        if (!body.text) {
            return new Response(
                JSON.stringify({ error: "Missing 'text' parameter" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Validate text length
        if (body.text.length > 5000) {
            return new Response(
                JSON.stringify({ error: "Text too long (max 5000 chars)" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Prepare Piper request
        const piperRequest = {
            text: body.text,
            speaker: body.speaker || "en_US-lessac-high",
            lengthScale: body.lengthScale || 0.9,
        };

        // Forward to Piper TTS
        const piperResponse = await fetch(`${piperUrl}/api/tts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(piperRequest),
        });

        if (!piperResponse.ok) {
            const error = await piperResponse.text();
            console.error(`[Piper Proxy] Error from Piper: ${error}`);
            return new Response(
                JSON.stringify({
                    error: "Synthesis failed",
                    details: error.substring(0, 200),
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        // Get audio data
        const audioBuffer = await piperResponse.arrayBuffer();

        // Create response with audio
        const response = new Response(audioBuffer, {
            headers: {
                "Content-Type": "audio/wav",
                "Cache-Control": "public, max-age=86400", // Cache for 24h
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            },
        });

        console.log(
            `[Piper Proxy] ✅ Successfully synthesized ${body.text.length} chars`
        );
        return response;
    } catch (error) {
        console.error("[Piper Proxy] Error:", error);
        return new Response(
            JSON.stringify({
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
});
