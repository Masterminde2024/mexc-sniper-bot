/**
 * Batch Insert Service
 *
 * Provides efficient batch insertion operations with deduplication and validation.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry } from "@/src/db";
import { patternEmbeddings, snipeTargets } from "@/src/db/schema";
import { toSafeError } from "@/src/lib/error-type-utils";

// ============================================================================
// Types and Schemas
// ============================================================================

const BatchInsertOptionsSchema = z.object({
  chunkSize: z.number().min(1).max(1000).default(50),
  enableDeduplication: z.boolean().default(true),
  onConflictStrategy: z.enum(["ignore", "update", "error"]).default("ignore"),
  validateData: z.boolean().default(true),
});

type BatchInsertOptions = z.infer<typeof BatchInsertOptionsSchema>;

interface PatternEmbeddingBatch {
  patternId: string;
  patternType: string;
  symbolName: string;
  patternData: string;
  embedding: string;
  confidence: number;
  discoveredAt: Date;
}

interface SnipeTargetBatch {
  id?: string;
  userId: string;
  symbolName: string;
  vcoinId: string;
  entryPrice?: number;
  positionSizeUsdt: number;
  stopLossPercent: number; // Required field that was missing
  confidenceScore: number;
  status: string;
  priority: number;
  entryStrategy?: string;
  takeProfitLevel?: number;
  takeProfitCustom?: number;
  riskLevel?: string;
  maxRetries?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class BatchInsertService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-insert-service]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-insert-service]", message, context || ""),
    error: (message: string, context?: unknown) =>
      console.error("[batch-insert-service]", message, context || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-insert-service]", message, context || ""),
  };

  /**
   * Batch insert pattern embeddings with optimized chunking
   */
  async batchInsertPatternEmbeddings(
    embeddings: PatternEmbeddingBatch[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<{
    success: boolean;
    inserted: number;
    duplicates: number;
    errors: string[];
    details?: unknown;
  }> {
    const opts = BatchInsertOptionsSchema.parse(options);
    const errors: string[] = [];
    let totalInserted = 0;
    let totalDuplicates = 0;

    try {
      // Validate data if requested
      if (opts.validateData) {
        const validationResult = this.validatePatternEmbeddings(embeddings);
        if (!validationResult.isValid) {
          return {
            success: false,
            inserted: 0,
            duplicates: 0,
            errors: validationResult.errors,
          };
        }
      }

      // Process in chunks
      const chunks = this.chunkArray(embeddings, opts.chunkSize);
      this.logger.info(
        `Processing ${embeddings.length} embeddings in ${chunks.length} chunks`
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logger.debug(
          `Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`
        );

        try {
          const result = await this.insertEmbeddingChunk(chunk, opts);
          totalInserted += result.inserted;
          totalDuplicates += result.duplicates;

          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const safeError = toSafeError(error);
          const errorMsg = `Chunk ${i + 1} failed: ${safeError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, {
            chunkIndex: i,
            chunkSize: chunk.length,
          });
        }
      }

      const success = errors.length === 0;
      this.logger.info("Batch insert pattern embeddings completed", {
        success,
        totalInserted,
        totalDuplicates,
        errorCount: errors.length,
      });

      return {
        success,
        inserted: totalInserted,
        duplicates: totalDuplicates,
        errors,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch insert pattern embeddings failed", {
        error: safeError.message,
      });

      return {
        success: false,
        inserted: totalInserted,
        duplicates: totalDuplicates,
        errors: [safeError.message],
      };
    }
  }

  /**
   * Batch insert snipe targets with optimized performance
   */
  async batchInsertSnipeTargets(
    targets: SnipeTargetBatch[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<{
    success: boolean;
    inserted: number;
    duplicates: number;
    errors: string[];
    details?: unknown;
  }> {
    const opts = BatchInsertOptionsSchema.parse(options);
    const errors: string[] = [];
    let totalInserted = 0;
    let totalDuplicates = 0;

    try {
      // Validate data if requested
      if (opts.validateData) {
        const validationResult = this.validateSnipeTargets(targets);
        if (!validationResult.isValid) {
          return {
            success: false,
            inserted: 0,
            duplicates: 0,
            errors: validationResult.errors,
          };
        }
      }

      // Deduplicate if enabled
      let processedTargets = targets;
      if (opts.enableDeduplication) {
        processedTargets = await this.deduplicateSnipeTargets(targets);
        totalDuplicates = targets.length - processedTargets.length;
        this.logger.debug(
          `Deduplication removed ${totalDuplicates} duplicate targets`
        );
      }

      // Process in chunks
      const chunks = this.chunkArray(processedTargets, opts.chunkSize);
      this.logger.info(
        `Processing ${processedTargets.length} targets in ${chunks.length} chunks`
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logger.debug(
          `Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`
        );

        try {
          const result = await this.insertTargetChunk(chunk, opts);
          totalInserted += result.inserted;

          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const safeError = toSafeError(error);
          const errorMsg = `Chunk ${i + 1} failed: ${safeError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, {
            chunkIndex: i,
            chunkSize: chunk.length,
          });
        }
      }

      const success = errors.length === 0;
      this.logger.info("Batch insert snipe targets completed", {
        success,
        totalInserted,
        totalDuplicates,
        errorCount: errors.length,
      });

      return {
        success,
        inserted: totalInserted,
        duplicates: totalDuplicates,
        errors,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch insert snipe targets failed", {
        error: safeError.message,
      });

      return {
        success: false,
        inserted: totalInserted,
        duplicates: totalDuplicates,
        errors: [safeError.message],
      };
    }
  }

  /**
   * Insert a chunk of pattern embeddings
   */
  private async insertEmbeddingChunk(
    chunk: PatternEmbeddingBatch[],
    options: BatchInsertOptions
  ): Promise<{ inserted: number; duplicates: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const insertData = chunk.map((embedding) => ({
        patternId: embedding.patternId,
        patternType: embedding.patternType,
        symbolName: embedding.symbolName,
        patternData: embedding.patternData,
        embedding: embedding.embedding,
        confidence: embedding.confidence,
        discoveredAt: embedding.discoveredAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      let result;

      if (options.onConflictStrategy === "ignore") {
        result = await executeWithRetry(
          () =>
            db
              .insert(patternEmbeddings)
              .values(insertData)
              .onConflictDoNothing(),
          "Insert pattern embeddings"
        );
      } else if (options.onConflictStrategy === "update") {
        result = await executeWithRetry(
          () =>
            db
              .insert(patternEmbeddings)
              .values(insertData)
              .onConflictDoUpdate({
                target: [patternEmbeddings.patternId],
                set: {
                  patternData: sql`excluded.pattern_data`,
                  embedding: sql`excluded.embedding`,
                  confidence: sql`excluded.confidence`,
                  updatedAt: sql`excluded.updated_at`,
                },
              }),
          "Insert pattern embeddings with update"
        );
      } else {
        result = await executeWithRetry(
          () => db.insert(patternEmbeddings).values(insertData),
          "Insert pattern embeddings"
        );
      }

      const inserted = (result as any)?.changes || chunk.length;
      const duplicates = chunk.length - inserted;

      return { inserted, duplicates, errors };
    } catch (error) {
      const safeError = toSafeError(error);
      errors.push(safeError.message);
      return { inserted: 0, duplicates: 0, errors };
    }
  }

  /**
   * Insert a chunk of snipe targets
   */
  private async insertTargetChunk(
    chunk: SnipeTargetBatch[],
    options: BatchInsertOptions
  ): Promise<{ inserted: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const insertData = chunk.map((target) => ({
        userId: target.userId,
        symbolName: target.symbolName,
        vcoinId: target.vcoinId,
        entryPrice: target.entryPrice,
        positionSizeUsdt: target.positionSizeUsdt,
        stopLossPercent: target.stopLossPercent, // Required field
        confidenceScore: target.confidenceScore,
        status: target.status,
        priority: target.priority,
        entryStrategy: target.entryStrategy || "market",
        takeProfitLevel: target.takeProfitLevel || 2,
        takeProfitCustom: target.takeProfitCustom,
        riskLevel: target.riskLevel || "medium",
        maxRetries: target.maxRetries || 3,
        currentRetries: 0,
        createdAt: target.createdAt || new Date(),
        updatedAt: target.updatedAt || new Date(),
      }));

      let result;

      if (options.onConflictStrategy === "ignore") {
        result = await executeWithRetry(
          () =>
            db.insert(snipeTargets).values(insertData).onConflictDoNothing(),
          "Insert snipe targets"
        );
      } else if (options.onConflictStrategy === "update") {
        result = await executeWithRetry(
          () =>
            db
              .insert(snipeTargets)
              .values(insertData)
              .onConflictDoUpdate({
                target: [snipeTargets.id],
                set: {
                  entryPrice: sql`excluded.entry_price`,
                  positionSizeUsdt: sql`excluded.position_size_usdt`,
                  confidenceScore: sql`excluded.confidence_score`,
                  status: sql`excluded.status`,
                  updatedAt: sql`excluded.updated_at`,
                },
              }),
          "Insert snipe targets with update"
        );
      } else {
        result = await executeWithRetry(
          () => db.insert(snipeTargets).values(insertData),
          "Insert snipe targets"
        );
      }

      const inserted = (result as any)?.changes || chunk.length;
      return { inserted, errors };
    } catch (error) {
      const safeError = toSafeError(error);
      errors.push(safeError.message);
      return { inserted: 0, errors };
    }
  }

  /**
   * Validate pattern embeddings data
   */
  private validatePatternEmbeddings(embeddings: PatternEmbeddingBatch[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];

      if (!embedding.patternId || typeof embedding.patternId !== "string") {
        errors.push(`Item ${i}: Invalid patternId`);
      }

      if (!embedding.patternType || typeof embedding.patternType !== "string") {
        errors.push(`Item ${i}: Invalid patternType`);
      }

      if (!embedding.symbolName || typeof embedding.symbolName !== "string") {
        errors.push(`Item ${i}: Invalid symbolName`);
      }

      if (
        typeof embedding.confidence !== "number" ||
        embedding.confidence < 0 ||
        embedding.confidence > 100
      ) {
        errors.push(`Item ${i}: Invalid confidence (must be 0-100)`);
      }

      if (
        !embedding.discoveredAt ||
        !(embedding.discoveredAt instanceof Date)
      ) {
        errors.push(`Item ${i}: Invalid discoveredAt (must be Date)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate snipe targets data
   */
  private validateSnipeTargets(targets: SnipeTargetBatch[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];

      if (!target.userId || typeof target.userId !== "string") {
        errors.push(`Item ${i}: Invalid userId`);
      }

      if (!target.symbolName || typeof target.symbolName !== "string") {
        errors.push(`Item ${i}: Invalid symbolName`);
      }

      if (!target.vcoinId || typeof target.vcoinId !== "string") {
        errors.push(`Item ${i}: Invalid vcoinId`);
      }

      if (
        typeof target.positionSizeUsdt !== "number" ||
        target.positionSizeUsdt <= 0
      ) {
        errors.push(
          `Item ${i}: Invalid positionSizeUsdt (must be positive number)`
        );
      }

      if (
        typeof target.confidenceScore !== "number" ||
        target.confidenceScore < 0 ||
        target.confidenceScore > 100
      ) {
        errors.push(`Item ${i}: Invalid confidenceScore (must be 0-100)`);
      }

      if (!target.status || typeof target.status !== "string") {
        errors.push(`Item ${i}: Invalid status`);
      }

      if (
        typeof target.priority !== "number" ||
        target.priority < 1 ||
        target.priority > 5
      ) {
        errors.push(`Item ${i}: Invalid priority (must be 1-5)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Deduplicate snipe targets based on userId, symbolName, and vcoinId
   */
  private async deduplicateSnipeTargets(
    targets: SnipeTargetBatch[]
  ): Promise<SnipeTargetBatch[]> {
    // Create a set of existing combinations
    const existingTargets = await db
      .select({
        userId: snipeTargets.userId,
        symbolName: snipeTargets.symbolName,
        vcoinId: snipeTargets.vcoinId,
      })
      .from(snipeTargets);

    const existingSet = new Set(
      existingTargets.map(
        (t: any) => `${t.userId}:${t.symbolName}:${t.vcoinId}`
      )
    );

    // Filter out duplicates
    return targets.filter((target) => {
      const key = `${target.userId}:${target.symbolName}:${target.vcoinId}`;
      return !existingSet.has(key);
    });
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
