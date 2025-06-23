import { NextRequest, NextResponse } from "next/server";
import { AutoSnipingExecutionService } from "../../../../src/services/auto-sniping-execution-service";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "../../../../src/lib/api-response";
import { handleApiError } from "../../../../src/lib/error-handler";

const autoSnipingService = AutoSnipingExecutionService.getInstance();

export async function GET() {
  try {
    const report = await autoSnipingService.getExecutionReport();
    
    return apiResponse(
      createSuccessResponse(report, {
        message: "Auto-sniping configuration retrieved successfully"
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Auto-sniping config GET error:", error);
    return handleApiError(error, { message: "Failed to get auto-sniping configuration" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body as { action: string; config?: Record<string, unknown> };

    if (!action) {
      return apiResponse(
        createErrorResponse("Action is required", {
          message: "Please specify action: update, start, or stop"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    switch (action) {
      case "enable":
        console.log("🚀 Auto-sniping is always enabled. Updating config:", config);
        if (config) {
          autoSnipingService.updateConfig(config);
        }
        
        const enabledReport = await autoSnipingService.getExecutionReport();
        return apiResponse(
          createSuccessResponse(
            { enabled: true, config: enabledReport.config },
            { message: "Auto-sniping is always enabled. Configuration updated successfully." }
          ),
          HTTP_STATUS.OK
        );

      case "disable":
        console.log("⏹️ Auto-sniping cannot be disabled. Stopping execution instead.");
        autoSnipingService.stopExecution();
        
        return apiResponse(
          createSuccessResponse(
            { enabled: true, status: "idle" },
            { message: "Auto-sniping execution stopped. Auto-sniping remains enabled." }
          ),
          HTTP_STATUS.OK
        );

      case "update":
        if (!config) {
          return apiResponse(
            createErrorResponse("Configuration is required for update action", {
              message: "Please provide config object for update"
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        console.log("⚙️ Updating auto-sniping config:", config);
        autoSnipingService.updateConfig(config);
        
        const updatedReport = await autoSnipingService.getExecutionReport();
        return apiResponse(
          createSuccessResponse(
            { config: updatedReport.config },
            { message: "Auto-sniping configuration updated successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "start":
        console.log("▶️ Starting auto-sniping execution");
        
        if (!autoSnipingService.isReadyForTrading()) {
          const currentReport = await autoSnipingService.getExecutionReport();
          return apiResponse(
            createErrorResponse("Auto-sniping is not ready for trading", {
              message: "Auto-sniping must not be already running",
              currentStatus: currentReport.status
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        await autoSnipingService.startExecution();
        
        return apiResponse(
          createSuccessResponse(
            { status: "active" },
            { message: "Auto-sniping execution started successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "stop":
        console.log("⏹️ Stopping auto-sniping execution");
        autoSnipingService.stopExecution();
        
        return apiResponse(
          createSuccessResponse(
            { status: "idle" },
            { message: "Auto-sniping execution stopped successfully" }
          ),
          HTTP_STATUS.OK
        );

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            message: "Action must be one of: enable, disable, update, start, stop",
            availableActions: ["enable", "disable", "update", "start", "stop"]
          }),
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    console.error("Auto-sniping config POST error:", error);
    return handleApiError(error, { message: "Failed to configure auto-sniping" });
  }
}