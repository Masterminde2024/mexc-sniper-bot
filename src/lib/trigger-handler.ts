import type { NextRequest } from "next/server";
import { inngest } from "../inngest/client";
import { createErrorResponse, createSuccessResponse } from "./api-response";

/**
 * Factory function to create consistent trigger handlers for Inngest workflows
 */
export function createTriggerHandler(
  eventName: string,
  description: string,
  dataTransform?: (body: any) => any
) {
  return async function POST(request: NextRequest) {
    try {
      // Parse request body if present
      let body = {};
      try {
        body = await request.json();
      } catch {
        // No body or invalid JSON, use empty object
      }

      // Transform data if transformer provided
      const eventData = dataTransform ? dataTransform(body) : body;

      // Send event to Inngest
      const event = await inngest.send({
        name: eventName,
        data: {
          triggeredBy: "ui",
          timestamp: new Date().toISOString(),
          ...eventData,
        },
      });

      return createSuccessResponse(
        {
          message: `${description} workflow triggered`,
          eventId: event.ids[0],
          ...eventData,
        },
        {
          workflow: description,
          eventName,
        }
      );
    } catch (error) {
      return createErrorResponse(error as string, {
        workflow: description,
        eventName,
      });
    }
  };
}

/**
 * Common trigger handlers for MEXC workflows
 */
export const TriggerHandlers = {
  calendarPoll: createTriggerHandler("mexc/calendar.poll", "Calendar polling"),

  patternAnalysis: createTriggerHandler(
    "mexc/patterns.analyze",
    "Pattern analysis",
    (body) => ({
      symbols: body.symbols || [],
    })
  ),

  symbolWatch: createTriggerHandler(
    "mexc/symbol.watch",
    "Symbol watch",
    (body) => ({
      vcoinId: body.vcoinId,
      symbol: body.symbol,
    })
  ),

  tradingStrategy: createTriggerHandler(
    "mexc/strategy.create",
    "Trading strategy creation",
    (body) => ({
      symbols: body.symbols || [],
      strategy: body.strategy || "balanced",
    })
  ),

  emergency: createTriggerHandler(
    "mexc/emergency.stop",
    "Emergency stop",
    (body) => ({
      reason: body.reason || "Manual trigger",
      userId: body.userId,
    })
  ),
};

/**
 * Higher-order function to add authentication to trigger handlers
 */
export function withAuth(handler: Function, _requiredRole = "user") {
  return async (request: NextRequest) => {
    // Extract and validate authentication headers
    const authHeader = request.headers.get("authorization");
    const apiKey = request.headers.get("x-api-key");

    // Check for valid authentication
    if (!authHeader && !apiKey) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // For now, accept any bearer token or API key
    // Future: Implement proper token validation
    const isAuthenticated =
      authHeader?.startsWith("Bearer ") || Boolean(apiKey);

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication credentials" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return handler(request);
  };
}

/**
 * Higher-order function to add rate limiting to trigger handlers
 */
export function withRateLimit(
  handler: Function,
  maxRequests = 10,
  windowMs = 60000
) {
  const requests = new Map<string, number[]>();

  return async (request: NextRequest) => {
    const clientIP =
      (request as any).ip ||
      request.headers.get("x-forwarded-for") ||
      "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request log for this IP
    const clientRequests = requests.get(clientIP) || [];

    // Remove old requests outside the window
    const recentRequests = clientRequests.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if rate limit exceeded
    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const _retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
      return createErrorResponse("Rate limit exceeded");
    }

    // Add current request
    recentRequests.push(now);
    requests.set(clientIP, recentRequests);

    // Call the original handler
    return handler(request);
  };
}
