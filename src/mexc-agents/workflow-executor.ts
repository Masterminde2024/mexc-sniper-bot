import { toSafeError } from "@/src/lib/error-type-utils";
import type { CalendarEntry } from "@/src/services/api/mexc-unified-exports";
import type { AgentManager } from "./agent-manager";
import { CalendarWorkflow } from "./calendar-workflow";
import type { DataFetcher } from "./data-fetcher";
import type {
  CalendarDiscoveryWorkflowRequest,
  MexcWorkflowResult,
  PatternAnalysisWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
  WorkflowExecutionContext,
} from "./orchestrator-types";
import { PatternAnalysisWorkflow } from "./pattern-analysis-workflow";
import { SymbolAnalysisWorkflow } from "./symbol-analysis-workflow";
import { TradingStrategyWorkflow } from "./trading-strategy-workflow";

export class WorkflowExecutor {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-executor]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-executor]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[workflow-executor]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-executor]", message, context || ""),
  };

  private calendarWorkflow: CalendarWorkflow;
  private symbolAnalysisWorkflow: SymbolAnalysisWorkflow;
  private patternAnalysisWorkflow: PatternAnalysisWorkflow;
  private tradingStrategyWorkflow: TradingStrategyWorkflow;
  private agentManager: AgentManager;
  private dataFetcher: DataFetcher;

  constructor(agentManager: AgentManager, dataFetcher: DataFetcher) {
    this.agentManager = agentManager;
    this.dataFetcher = dataFetcher;

    // Initialize workflow modules
    this.calendarWorkflow = new CalendarWorkflow();
    this.symbolAnalysisWorkflow = new SymbolAnalysisWorkflow();
    this.patternAnalysisWorkflow = new PatternAnalysisWorkflow();
    this.tradingStrategyWorkflow = new TradingStrategyWorkflow();
  }

  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const context = this.createExecutionContext("calendar-discovery");

    try {
      console.info(
        `[WorkflowExecutor] Starting calendar discovery workflow - trigger: ${request.trigger}`
      );

      // Step 1: Fetch calendar data
      console.info("[WorkflowExecutor] Step 1: Fetching calendar data");
      context.currentStep = "fetch-calendar-data";
      const calendarData = await this.dataFetcher.fetchCalendarData();

      // Step 2: AI analysis of calendar data
      console.info("[WorkflowExecutor] Step 2: AI calendar analysis");
      context.currentStep = "calendar-analysis";
      const calendarEntries = calendarData?.success ? calendarData.data : [];
      const calendarAnalysis = await this.agentManager
        .getCalendarAgent()
        .scanForNewListings(calendarEntries as CalendarEntry[]);

      // Step 3: Pattern discovery on calendar data
      console.info("[WorkflowExecutor] Step 3: Pattern discovery analysis");
      context.currentStep = "pattern-discovery";
      const patternAnalysis = await this.agentManager
        .getPatternDiscoveryAgent()
        .discoverNewListings(calendarEntries as CalendarEntry[]);

      // Step 4: Combine results using calendar workflow
      console.info("[WorkflowExecutor] Step 4: Combining analysis results");
      context.currentStep = "combine-results";
      const combinedAnalysis =
        await this.calendarWorkflow.analyzeDiscoveryResults(
          calendarAnalysis,
          patternAnalysis,
          calendarData
        );

      const duration = Date.now() - context.startTime;
      context.agentsUsed.push("mexc-api", "calendar", "pattern-discovery");

      return {
        success: true,
        data: {
          newListings: combinedAnalysis.newListings,
          readyTargets: combinedAnalysis.readyTargets,
          analysisTimestamp: combinedAnalysis.analysisTimestamp,
          trigger: request.trigger,
          calendarData: calendarEntries,
          apiStatus: calendarData?.success ? "connected" : "fallback",
        },
        metadata: {
          agentsUsed: context.agentsUsed,
          duration,
          confidence: combinedAnalysis.confidence,
        },
      };
    } catch (error) {
      console.error(
        "[WorkflowExecutor] Calendar discovery workflow failed:",
        error
      );
      return this.createErrorResult(error, context.agentsUsed);
    }
  }

  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const context = this.createExecutionContext("symbol-analysis");

    try {
      console.info(
        `[WorkflowExecutor] Starting symbol analysis workflow for: ${request.vcoinId}`
      );

      // Step 1: Fetch symbol data
      console.info(
        `[WorkflowExecutor] Step 1: Fetching symbol data for: ${request.vcoinId}`
      );
      context.currentStep = "fetch-symbol-data";
      const symbolData = await this.dataFetcher.fetchSymbolData(
        request.vcoinId
      );

      // Step 2: Multi-agent analysis
      console.info("[WorkflowExecutor] Step 2: Multi-agent analysis");
      context.currentStep = "multi-agent-analysis";
      const [readinessAnalysis, patternAnalysis, marketAnalysis] =
        await Promise.all([
          this.agentManager
            .getSymbolAnalysisAgent()
            .process(`Analyze symbol readiness for ${request.vcoinId}`, {
              vcoinId: request.vcoinId,
              symbolName: request.symbolName,
              projectName: request.projectName,
              launchTime: request.launchTime,
            }),
          this.agentManager
            .getPatternDiscoveryAgent()
            .process(`Validate pattern for ${request.vcoinId}`, {
              analysisType: "monitoring",
              vcoinId: request.vcoinId,
            }),
          this.agentManager
            .getMexcApiAgent()
            .process(`Analyze market microstructure for ${request.vcoinId}`, {
              endpoint: "/market-depth",
              vcoinId: request.vcoinId,
            }),
        ]);

      // Step 3: Combine analysis
      console.info("[WorkflowExecutor] Step 3: Combining symbol analysis");
      context.currentStep = "combine-analysis";
      const combinedAnalysis =
        await this.symbolAnalysisWorkflow.combineSymbolAnalysis(
          readinessAnalysis,
          patternAnalysis,
          marketAnalysis,
          symbolData
        );

      const duration = Date.now() - context.startTime;
      context.agentsUsed.push(
        "symbol-analysis",
        "pattern-discovery",
        "mexc-api"
      );

      return {
        success: true,
        data: {
          vcoinId: request.vcoinId,
          symbolData,
          readinessScore: combinedAnalysis.readinessScore,
          riskAssessment: combinedAnalysis.riskAssessment,
          tradingRecommendation: combinedAnalysis.tradingRecommendation,
          marketMicrostructure: combinedAnalysis.marketMicrostructure,
          analysisTimestamp: combinedAnalysis.metadata.analysisTimestamp,
        },
        metadata: {
          agentsUsed: combinedAnalysis.metadata.agentsUsed,
          duration,
          confidence: combinedAnalysis.metadata.confidence,
        },
      };
    } catch (error) {
      console.error(
        `[WorkflowExecutor] Symbol analysis workflow failed for ${request.vcoinId}:`,
        error
      );
      return this.createErrorResult(error, context.agentsUsed);
    }
  }

  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const context = this.createExecutionContext("pattern-analysis");

    try {
      console.info(
        `[WorkflowExecutor] Starting enhanced pattern analysis workflow - type: ${request.analysisType}`
      );

      // Step 1: Enhanced Pattern Analysis using Centralized Engine
      console.info(
        "[WorkflowExecutor] Step 1: Enhanced pattern analysis with centralized engine"
      );
      context.currentStep = "enhanced-pattern-analysis";

      // Prepare input for enhanced analysis
      const analysisInput: any = {
        vcoinId: request.vcoinId,
        symbols: request.symbols,
      };

      // If we have symbol data, use it directly
      if (
        (request as any).symbolData &&
        (request as any).symbolData.length > 0
      ) {
        analysisInput.symbolData = (request as any).symbolData;
      }

      // Try enhanced analysis first
      let processedAnalysis;
      try {
        processedAnalysis =
          await this.patternAnalysisWorkflow.analyzePatternsWithEngine(
            analysisInput,
            request.analysisType,
            {
              confidenceThreshold: 70,
              includeAgentAnalysis: true,
              enableAdvanceDetection: true,
            }
          );
        context.agentsUsed.push(
          "pattern-detection-engine",
          "pattern-strategy-orchestrator"
        );

        console.info(
          "[WorkflowExecutor] Enhanced pattern analysis completed successfully"
        );
      } catch (engineError) {
        console.warn(
          "[WorkflowExecutor] Enhanced analysis failed, falling back to legacy:",
          engineError
        );

        // Fallback to legacy pattern analysis
        const patternAnalysis = await this.agentManager
          .getPatternDiscoveryAgent()
          .analyzePatterns({
            vcoinId: request.vcoinId || "",
            symbols: request.symbols,
            analysisType: request.analysisType,
          });

        processedAnalysis = await this.patternAnalysisWorkflow.analyzePatterns(
          patternAnalysis,
          request.symbols,
          request.analysisType
        );
        context.agentsUsed.push("pattern-discovery");
      }

      const duration = Date.now() - context.startTime;

      return {
        success: true,
        data: {
          patterns: processedAnalysis.patterns,
          signals: processedAnalysis.signals,
          recommendation: processedAnalysis.recommendation,
          analysisType: request.analysisType,
          metadata: processedAnalysis.metadata,
          // Enhanced fields
          engineResult: processedAnalysis.engineResult,
          strategicRecommendations: processedAnalysis.strategicRecommendations,
          enhancedAnalysis: !!processedAnalysis.engineResult,
        },
        metadata: {
          agentsUsed: context.agentsUsed,
          duration,
          confidence: processedAnalysis.confidence,
        },
      };
    } catch (error) {
      console.error(
        `[WorkflowExecutor] Pattern analysis workflow failed:`,
        error
      );
      return this.createErrorResult(error, context.agentsUsed);
    }
  }

  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const context = this.createExecutionContext("trading-strategy");

    try {
      console.info(
        `[WorkflowExecutor] Starting trading strategy workflow for: ${request.vcoinId}`
      );

      // Step 1: Strategy analysis
      console.info("[WorkflowExecutor] Step 1: Strategy analysis");
      context.currentStep = "strategy-analysis";
      const strategyAnalysis = await this.agentManager
        .getStrategyAgent()
        .createStrategy({
          action: "create",
          symbols: [(request.symbolData as any)?.cd],
          riskLevel: request.riskLevel || "medium",
          timeframe: "medium",
        });

      // Step 2: Compile strategy
      console.info("[WorkflowExecutor] Step 2: Compiling trading strategy");
      context.currentStep = "compile-strategy";
      const compiledStrategy =
        await this.tradingStrategyWorkflow.compileTradingStrategy(
          strategyAnalysis,
          request.vcoinId,
          request.symbolData as any,
          request.riskLevel,
          request.capital
        );

      const duration = Date.now() - context.startTime;
      context.agentsUsed.push("strategy");

      return {
        success: true,
        data: {
          vcoinId: request.vcoinId,
          strategy: compiledStrategy.strategy,
          riskManagement: compiledStrategy.riskManagement,
          executionPlan: compiledStrategy.executionPlan,
          metadata: compiledStrategy.metadata,
        },
        metadata: {
          agentsUsed: context.agentsUsed,
          duration,
          confidence: compiledStrategy.confidence,
        },
      };
    } catch (error) {
      console.error(
        `[WorkflowExecutor] Trading strategy workflow failed for ${request.vcoinId}:`,
        error
      );
      return this.createErrorResult(error, context.agentsUsed);
    }
  }

  private createExecutionContext(
    workflowType: string
  ): WorkflowExecutionContext {
    return {
      startTime: Date.now(),
      agentsUsed: [],
      stepCount: 0,
      currentStep: `init-${workflowType}`,
    };
  }

  private createErrorResult(
    error: unknown,
    agentsUsed: string[]
  ): MexcWorkflowResult {
    const safeError = toSafeError(error);
    return {
      success: false,
      error: safeError.message,
      metadata: {
        agentsUsed,
        duration: 0,
        confidence: 0,
      },
    };
  }
}
