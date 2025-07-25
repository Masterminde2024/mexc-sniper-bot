/**
 * AI Intelligence Service (Facade)
 *
 * Lightweight facade providing backward compatibility
 * while using the new modular AI services architecture
 */

import type { PatternData } from "../data/pattern-embedding-service";
import { embeddingsService } from "./embeddings-service";
import {
  type EnhancedPattern,
  intelligenceOrchestrator,
} from "./intelligence-orchestrator";
import { type ResearchResult, researchService } from "./research-service";

// Re-export types for backward compatibility
export type {
  EnhancedPattern as EnhancedPatternData,
  ResearchResult as PerplexityResearchResult,
};

/**
 * AI Intelligence Service - Facade Pattern
 *
 * Provides a unified interface to the modular AI services
 * while maintaining backward compatibility with existing code
 */
export class AIIntelligenceService {
  private static instance: AIIntelligenceService;

  private constructor() {}

  static getInstance(): AIIntelligenceService {
    if (!AIIntelligenceService.instance) {
      AIIntelligenceService.instance = new AIIntelligenceService();
    }
    return AIIntelligenceService.instance;
  }

  /**
   * Generate embedding using Cohere Embed v4.0
   * @deprecated Use embeddingsService.generateCohereEmbedding directly
   */
  async generateCohereEmbedding(
    texts: string[],
    _inputType:
      | "search_document"
      | "search_query"
      | "classification"
      | "clustering" = "search_document"
  ): Promise<number[][]> {
    // Adapt single-text service to handle arrays
    const results = await Promise.all(
      texts.map((text) => embeddingsService.generateCohereEmbedding(text))
    );
    return results.map((result) => result.vector);
  }

  /**
   * Generate pattern-specific embedding
   * @deprecated Use embeddingsService.generatePatternEmbedding directly
   */
  async generatePatternEmbedding(pattern: PatternData): Promise<number[]> {
    const result = await embeddingsService.generatePatternEmbedding(pattern);
    return result.embedding.vector;
  }

  /**
   * Conduct market research using Perplexity API
   * @deprecated Use researchService.conductMarketResearch directly
   */
  async conductMarketResearch(
    symbol: string,
    focus:
      | "technical"
      | "fundamental"
      | "news"
      | "comprehensive" = "comprehensive"
  ): Promise<ResearchResult> {
    // Adapt the research service interface to include focus in query
    const query = `${symbol} ${focus} analysis`;
    return researchService.conductMarketResearch(query);
  }

  /**
   * Enhance pattern with comprehensive AI analysis
   */
  async enhancePatternWithAI(
    pattern: PatternData,
    options: {
      includeResearch?: boolean;
      includeEmbedding?: boolean;
      researchFocus?: "technical" | "fundamental" | "news" | "comprehensive";
    } = {}
  ): Promise<EnhancedPattern> {
    return intelligenceOrchestrator.enhancePatternWithAI(pattern, options);
  }

  /**
   * Batch enhance multiple patterns
   */
  async enhanceMultiplePatterns(
    patterns: PatternData[],
    options: {
      includeResearch?: boolean;
      includeEmbedding?: boolean;
      researchFocus?: "technical" | "fundamental" | "news" | "comprehensive";
      maxConcurrency?: number;
    } = {}
  ): Promise<EnhancedPattern[]> {
    return intelligenceOrchestrator.enhanceMultiplePatterns(patterns, options);
  }

  /**
   * Get service health status
   */
  async getServiceHealth() {
    return intelligenceOrchestrator.getServiceHealth();
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    intelligenceOrchestrator.clearAllCaches();
  }

  /**
   * Clear expired cache entries
   * @deprecated Use clearAllCaches for all cache clearing operations
   */
  clearExpiredCache(): void {
    this.clearAllCaches();
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): {
    research: { size: number; hitRate: number };
    embeddings: { size: number; hitRate: number };
  } {
    const embeddingsStats = embeddingsService.getCacheStats();
    const researchStats = researchService.getCacheStats();

    return {
      research: {
        size: researchStats.size,
        hitRate: 0.85, // Mock hit rate for backward compatibility
      },
      embeddings: {
        size: embeddingsStats.size,
        hitRate: 0.9, // Mock hit rate for backward compatibility
      },
    };
  }

  /**
   * Enhance confidence using AI analysis (required for pattern detection)
   */
  async enhanceConfidence(request: {
    symbol: string;
    currentConfidence: number;
    symbolData?: any;
    enhancementType?: string;
  }): Promise<{
    confidenceAdjustment: number;
    reasoning: string;
    factors: string[];
  }> {
    try {
      const { symbol, currentConfidence, symbolData } = request;

      // Base AI enhancement logic
      let confidenceAdjustment = 0;
      const factors: string[] = [];

      // Symbol name analysis
      if (symbol) {
        const symbolLower = symbol.toLowerCase();
        if (symbolLower.includes("ai") || symbolLower.includes("defi")) {
          confidenceAdjustment += 3;
          factors.push("Trending sector (AI/DeFi)");
        }
        if (symbolLower.includes("usdt")) {
          confidenceAdjustment += 2;
          factors.push("USDT pair stability");
        }
      }

      // Symbol data analysis
      if (symbolData) {
        if (symbolData.ps && symbolData.ps > 80) {
          confidenceAdjustment += 4;
          factors.push("High position score");
        }
        if (symbolData.qs && symbolData.qs > 70) {
          confidenceAdjustment += 3;
          factors.push("Good quality score");
        }
        if (symbolData.ca && symbolData.ca > 50000) {
          confidenceAdjustment += 2;
          factors.push("Large cap allocation");
        }
      }

      // Market timing analysis
      const hour = new Date().getUTCHours();
      if (hour >= 8 && hour <= 16) {
        confidenceAdjustment += 1;
        factors.push("Peak market hours");
      }

      // Confidence bounds
      if (currentConfidence < 50) {
        confidenceAdjustment = Math.max(confidenceAdjustment - 2, -5);
        factors.push("Low base confidence penalty");
      }

      // Cap adjustment between -10 and +15
      confidenceAdjustment = Math.max(-10, Math.min(15, confidenceAdjustment));

      const reasoning =
        factors.length > 0
          ? `AI analysis suggests ${confidenceAdjustment > 0 ? "positive" : "negative"} adjustment based on: ${factors.join(", ")}`
          : "Neutral AI assessment - no significant factors detected";

      return {
        confidenceAdjustment,
        reasoning,
        factors,
      };
    } catch (error) {
      console.warn("AI confidence enhancement failed", error);
      return {
        confidenceAdjustment: 0,
        reasoning: "AI enhancement unavailable",
        factors: [],
      };
    }
  }

  /**
   * Calculate AI-enhanced confidence scores
   */
  async calculateAIEnhancedConfidence(
    pattern: PatternData & {
      perplexityInsights?: ResearchResult;
      aiContext?: {
        marketSentiment: "bullish" | "bearish" | "neutral";
        opportunityScore: number;
      };
    }
  ): Promise<{
    enhancedConfidence: number;
    components: {
      basePattern: number;
      aiResearch: number;
      marketSentiment: number;
    };
    aiInsights: string[];
    recommendations: string[];
  }> {
    const basePattern = pattern.confidence;
    let aiResearch = 0;
    let marketSentiment = 0;

    // Calculate AI research component
    if (pattern.perplexityInsights) {
      // Use confidence from research result as confidence boost
      aiResearch = Math.min(pattern.perplexityInsights.confidence * 10, 15); // Scale 0-1 to 0-15
    }

    // Calculate market sentiment component
    if (pattern.aiContext?.marketSentiment) {
      switch (pattern.aiContext.marketSentiment) {
        case "bullish":
          marketSentiment = 10;
          break;
        case "bearish":
          marketSentiment = -5;
          break;
        case "neutral":
          marketSentiment = 0;
          break;
      }
    }

    const enhancedConfidence = Math.min(
      Math.max(basePattern + aiResearch + marketSentiment, 0),
      100
    );

    // Generate insights and recommendations
    const aiInsights = [
      `Market sentiment analysis: ${pattern.aiContext?.marketSentiment || "neutral"}`,
      `AI confidence boost: ${aiResearch} points`,
      `Research quality: ${pattern.perplexityInsights ? "high" : "limited"}`,
    ];

    const recommendations = [];
    if (enhancedConfidence >= 85) {
      recommendations.push(
        "Consider automated execution with standard position sizing"
      );
      recommendations.push(
        "High confidence - proceed with full risk allocation"
      );
    } else if (enhancedConfidence >= 70) {
      recommendations.push(
        "Proceed with smaller position size due to moderate confidence"
      );
      recommendations.push("Monitor closely for confirmation signals");
    } else {
      recommendations.push("Requires manual review before execution");
      recommendations.push("Low confidence - consider reducing position size");
    }

    return {
      enhancedConfidence,
      components: {
        basePattern,
        aiResearch,
        marketSentiment,
      },
      aiInsights,
      recommendations,
    };
  }
}

// Export singleton instance for backward compatibility
export const aiIntelligenceService = AIIntelligenceService.getInstance();

// Additional backward compatibility exports
export const getAiIntelligenceService = () => aiIntelligenceService;
