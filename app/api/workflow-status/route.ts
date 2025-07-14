/**
 * Workflow Status API Endpoint
 * Minimal implementation to eliminate import errors
 */

import { type NextRequest, NextResponse } from "next/server";

// Mock workflow definitions for frontend component compatibility
interface WorkflowDefinition {
  id: string;
  name: string;
  type: "event" | "scheduled";
  status: "running" | "stopped" | "error";
  lastRun?: string;
  nextRun?: string;
  schedule?: string;
  executionCount: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  description: string;
  trigger?: string;
}

const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: "mexc-pattern-analysis",
    name: "MEXC Pattern Analysis",
    type: "event",
    status: "running",
    trigger: "mexc/api.pattern.detection",
    lastRun: new Date(Date.now() - 300000).toISOString(),
    executionCount: 45,
    successCount: 43,
    errorCount: 2,
    avgDuration: 2400,
    description: "Analyzes market patterns for trading opportunities",
  },
  {
    id: "auto-sniping-execution",
    name: "Auto Sniping Execution",
    type: "event",
    status: "stopped",
    trigger: "snipe/target.ready",
    lastRun: new Date(Date.now() - 900000).toISOString(),
    executionCount: 12,
    successCount: 10,
    errorCount: 2,
    avgDuration: 800,
    description: "Executes snipe orders for ready targets",
  },
  {
    id: "market-data-collection",
    name: "Market Data Collection",
    type: "scheduled",
    status: "running",
    schedule: "*/30 * * * * *",
    nextRun: new Date(Date.now() + 30000).toISOString(),
    lastRun: new Date(Date.now() - 15000).toISOString(),
    executionCount: 2880,
    successCount: 2875,
    errorCount: 5,
    avgDuration: 450,
    description: "Collects and processes real-time market data",
  },
  {
    id: "calendar-sync",
    name: "Calendar Data Sync",
    type: "scheduled",
    status: "running",
    schedule: "0 */5 * * * *",
    nextRun: new Date(Date.now() + 120000).toISOString(),
    lastRun: new Date(Date.now() - 180000).toISOString(),
    executionCount: 576,
    successCount: 570,
    errorCount: 6,
    avgDuration: 1800,
    description: "Syncs MEXC calendar data for new token listings",
  },
  {
    id: "scheduled-calendar-monitoring",
    name: "Scheduled Calendar Check",
    type: "scheduled",
    status: "running",
    schedule: "*/5 * * * *",
    nextRun: new Date(Date.now() + 180000).toISOString(),
    lastRun: new Date(Date.now() - 120000).toISOString(),
    executionCount: 288,
    successCount: 286,
    errorCount: 2,
    avgDuration: 1200,
    description: "Regularly checks MEXC calendar for new listings",
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const includeMetrics = searchParams.get("includeMetrics") === "true";
    const _format = searchParams.get("format") || "workflows";

    let workflows = [...WORKFLOW_DEFINITIONS];

    // Filter by specific workflow if requested
    if (workflowId) {
      workflows = workflows.filter((w) => w.id === workflowId);
      if (workflows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Workflow not found",
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
    }

    // Add runtime metrics if requested
    const workflowsWithMetrics = workflows.map((workflow) => {
      const baseWorkflow = { ...workflow };

      if (includeMetrics) {
        return {
          ...baseWorkflow,
          metrics: {
            successRate:
              workflow.executionCount > 0
                ? (
                    (workflow.successCount / workflow.executionCount) *
                    100
                  ).toFixed(1)
                : "0.0",
            errorRate:
              workflow.executionCount > 0
                ? (
                    (workflow.errorCount / workflow.executionCount) *
                    100
                  ).toFixed(1)
                : "0.0",
            avgDurationFormatted: `${(workflow.avgDuration / 1000).toFixed(1)}s`,
            lastRunFormatted: workflow.lastRun
              ? new Date(workflow.lastRun).toLocaleString()
              : "Never",
            nextRunFormatted:
              "nextRun" in workflow && workflow.nextRun
                ? new Date(workflow.nextRun).toLocaleString()
                : "Not scheduled",
          },
        };
      }

      return baseWorkflow;
    });

    const response = {
      success: true,
      data: workflowsWithMetrics,
      summary: {
        totalWorkflows: workflows.length,
        runningWorkflows: workflows.filter((w) => w.status === "running")
          .length,
        stoppedWorkflows: workflows.filter((w) => w.status === "stopped")
          .length,
        errorWorkflows: workflows.filter((w) => w.status === "error").length,
        eventWorkflows: workflows.filter((w) => w.type === "event").length,
        scheduledWorkflows: workflows.filter((w) => w.type === "scheduled")
          .length,
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get workflow status:", { error: error });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get workflow status",
        fallbackData: {
          systemStatus: "error",
          lastUpdate: new Date().toISOString(),
          activeWorkflows: [],
          metrics: {
            readyTokens: 0,
            totalDetections: 0,
            successfulSnipes: 0,
            totalProfit: 0,
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body with better error handling
    let body: any;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Empty request body - workflow status updates require JSON data",
            example: {
              workflowId: "mexc-pattern-analysis",
              action: "start" // or "stop", "restart"
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { action, workflowId } = body;

    // Validate required parameters
    if (!workflowId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters",
          required: {
            workflowId: "string (workflow identifier)",
            action: "string (start|stop|restart)"
          },
          received: {
            workflowId: workflowId || "missing",
            action: action || "missing"
          },
          availableWorkflows: WORKFLOW_DEFINITIONS.map(w => w.id),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Find workflow
    const workflow = WORKFLOW_DEFINITIONS.find((w) => w.id === workflowId);
    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow not found",
          workflowId,
          availableWorkflows: WORKFLOW_DEFINITIONS.map(w => w.id),
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Update workflow status
    switch (action) {
      case "start":
        workflow.status = "running";
        break;
      case "stop":
        workflow.status = "stopped";
        break;
      case "restart":
        workflow.status = "running";
        workflow.lastRun = new Date().toISOString();
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action for workflow",
            action,
            validActions: ["start", "stop", "restart"],
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
    }

    console.log(`[WorkflowStatus] ${action} action performed on workflow: ${workflowId}`);

    return NextResponse.json({
      success: true,
      data: {
        workflowId,
        action,
        newStatus: workflow.status,
        message: `Workflow ${workflowId} ${action} successfully`,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          lastRun: workflow.lastRun,
          nextRun: workflow.nextRun,
        }
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Failed to update workflow status:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update workflow status", 
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
