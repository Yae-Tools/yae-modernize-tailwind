import { ConversionResult, ProcessingResult } from '../types/conversionTypes.js';
import { ErrorHandler } from './errorHandler.js';
import { cpus } from 'os';
import { promises as fs } from 'fs';

/**
 * Parallel Processing Engine for File Conversion
 *
 * Implements concurrent file processing with worker pool management,
 * memory usage monitoring, and progress aggregation.
 */

export interface ProcessingOptions {
  maxWorkers?: number;
  chunkSize?: number;
  memoryThreshold?: number; // MB
  progressCallback?: (processed: number, total: number, currentFile: string) => void;
}

export interface FileTask {
  filePath: string;
  conversions: string[];
  index: number;
}

export interface WorkerResult {
  filePath: string;
  success: boolean;
  changed: boolean;
  error?: Error;
  processingTime: number;
}

/**
 * Memory usage monitor
 */
class MemoryMonitor {
  private static readonly MB = 1024 * 1024;

  static getCurrentUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / this.MB);
  }

  static shouldPauseProcessing(threshold: number): boolean {
    return this.getCurrentUsage() > threshold;
  }

  static async waitForMemoryRelease(threshold: number, maxWaitMs = 5000): Promise<void> {
    const startTime = Date.now();

    while (this.getCurrentUsage() > threshold && Date.now() - startTime < maxWaitMs) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/**
 * File chunk distributor
 */
class ChunkDistributor {
  static distributeFiles(files: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];

    for (let i = 0; i < files.length; i += chunkSize) {
      chunks.push(files.slice(i, i + chunkSize));
    }

    return chunks;
  }

  static calculateOptimalChunkSize(totalFiles: number, maxWorkers: number): number {
    // Aim for at least 2-3 chunks per worker to ensure good load balancing
    const minChunksPerWorker = 3;
    const targetChunks = maxWorkers * minChunksPerWorker;

    // But don't make chunks too small (minimum 1 file per chunk)
    const chunkSize = Math.max(1, Math.ceil(totalFiles / targetChunks));

    // Also don't make chunks too large (maximum 10 files per chunk for responsiveness)
    return Math.min(chunkSize, 10);
  }
}

/**
 * Progress aggregator
 */
class ProgressAggregator {
  private processedFiles = 0;
  private totalFiles = 0;
  private currentFile = '';
  private callback?: (processed: number, total: number, currentFile: string) => void;

  constructor(
    totalFiles: number,
    callback?: (processed: number, total: number, currentFile: string) => void,
  ) {
    this.totalFiles = totalFiles;
    this.callback = callback;
  }

  updateProgress(filePath: string): void {
    this.processedFiles++;
    this.currentFile = filePath;

    if (this.callback) {
      this.callback(this.processedFiles, this.totalFiles, this.currentFile);
    }
  }

  getProgress(): { processed: number; total: number; percentage: number } {
    return {
      processed: this.processedFiles,
      total: this.totalFiles,
      percentage: this.totalFiles > 0 ? (this.processedFiles / this.totalFiles) * 100 : 0,
    };
  }
}

/**
 * Worker implementation for processing file chunks
 */
class FileWorker {
  static async processChunk(
    files: string[],
    conversions: string[],
    conversionFunctions: Record<string, (content: string, filePath?: string) => ConversionResult>,
  ): Promise<WorkerResult[]> {
    const results: WorkerResult[] = [];

    for (const filePath of files) {
      const startTime = Date.now();

      try {
        const result = await this.processFile(filePath, conversions, conversionFunctions);
        results.push({
          filePath,
          success: true,
          changed: result.changed,
          processingTime: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          filePath,
          success: false,
          changed: false,
          error: error instanceof Error ? error : new Error(String(error)),
          processingTime: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  private static async processFile(
    filePath: string,
    conversions: string[],
    conversionFunctions: Record<string, (content: string, filePath?: string) => ConversionResult>,
  ): Promise<{ changed: boolean }> {
    const content = await ErrorHandler.safeFileOperation(
      () => fs.readFile(filePath, 'utf-8'),
      filePath,
      'read',
    );

    if (!content) {
      return { changed: false };
    }

    let currentContent = content;
    let hasChanges = false;

    for (const conversion of conversions) {
      const conversionFunction = conversionFunctions[conversion];
      if (!conversionFunction) continue;

      const result = ErrorHandler.safeContentOperation(
        () => conversionFunction(currentContent, filePath),
        filePath,
      );

      if (result) {
        currentContent = result.newContent;
        if (result.changed) {
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      await ErrorHandler.safeFileOperation(
        () => fs.writeFile(filePath, currentContent, 'utf-8'),
        filePath,
        'write',
      );
    }

    return { changed: hasChanges };
  }
}

/**
 * Main parallel processing engine
 */
export class ParallelProcessor {
  private static getOptimalWorkerCount(): number {
    const cpuCount = cpus().length;
    // Use 75% of available cores, minimum 1, maximum 8
    return Math.max(1, Math.min(8, Math.floor(cpuCount * 0.75)));
  }

  static async processFiles(
    files: string[],
    conversions: string[],
    conversionFunctions: Record<string, (content: string, filePath?: string) => ConversionResult>,
    options: ProcessingOptions = {},
  ): Promise<ProcessingResult[]> {
    const {
      maxWorkers = this.getOptimalWorkerCount(),
      chunkSize = ChunkDistributor.calculateOptimalChunkSize(files.length, maxWorkers),
      memoryThreshold = 512, // 512MB
      progressCallback,
    } = options;

    // Initialize error tracking
    ErrorHandler.initSession(files.length);

    // Set up progress tracking
    const progressAggregator = new ProgressAggregator(files.length, progressCallback);

    // Distribute files into chunks
    const fileChunks = ChunkDistributor.distributeFiles(files, chunkSize);

    const results: ProcessingResult[] = [];
    const errors: Error[] = [];

    // Process chunks in parallel with worker limit
    for (let i = 0; i < fileChunks.length; i += maxWorkers) {
      const currentBatch = fileChunks.slice(i, i + maxWorkers);

      // Check memory usage before processing batch
      if (MemoryMonitor.shouldPauseProcessing(memoryThreshold)) {
        await MemoryMonitor.waitForMemoryRelease(memoryThreshold * 0.8);
      }

      // Process current batch in parallel
      const batchPromises = currentBatch.map((chunk) =>
        FileWorker.processChunk(chunk, conversions, conversionFunctions),
      );

      try {
        const batchResults = await Promise.all(batchPromises);

        // Flatten and process results
        for (const chunkResults of batchResults) {
          for (const workerResult of chunkResults) {
            ErrorHandler.incrementProcessedFiles();
            progressAggregator.updateProgress(workerResult.filePath);

            if (workerResult.success) {
              results.push({
                success: true,
                changes: workerResult.changed ? 1 : 0,
              });
            } else {
              results.push({
                success: false,
                error: workerResult.error,
              });

              if (workerResult.error) {
                errors.push(workerResult.error);
              }
            }
          }
        }
      } catch (error) {
        // Handle batch-level errors
        const batchError = error instanceof Error ? error : new Error(String(error));
        errors.push(batchError);

        // Mark all files in failed batch as failed
        for (const chunk of currentBatch) {
          for (const filePath of chunk) {
            results.push({
              success: false,
              error: batchError,
            });
            progressAggregator.updateProgress(filePath);
          }
        }
      }
    }

    return results;
  }

  /**
   * Process files sequentially (fallback mode)
   */
  static async processFilesSequential(
    files: string[],
    conversions: string[],
    conversionFunctions: Record<string, (content: string, filePath?: string) => ConversionResult>,
    progressCallback?: (processed: number, total: number, currentFile: string) => void,
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    ErrorHandler.initSession(files.length);

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];

      if (progressCallback) {
        progressCallback(i, files.length, filePath);
      }

      try {
        const chunkResult = await FileWorker.processChunk(
          [filePath],
          conversions,
          conversionFunctions,
        );
        const result = chunkResult[0];

        ErrorHandler.incrementProcessedFiles();

        results.push({
          success: result.success,
          changes: result.changed ? 1 : 0,
          error: result.error,
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return results;
  }

  /**
   * Auto-select processing mode based on file count and system resources
   */
  static async autoProcessFiles(
    files: string[],
    conversions: string[],
    conversionFunctions: Record<string, (content: string, filePath?: string) => ConversionResult>,
    progressCallback?: (processed: number, total: number, currentFile: string) => void,
  ): Promise<ProcessingResult[]> {
    const memoryUsage = MemoryMonitor.getCurrentUsage();
    const availableMemory = 1024 - memoryUsage; // Assume 1GB available, adjust as needed

    // Use parallel processing for larger file sets if we have enough memory
    const shouldUseParallel = files.length > 5 && availableMemory > 256;

    if (shouldUseParallel) {
      return this.processFiles(files, conversions, conversionFunctions, {
        progressCallback,
        memoryThreshold: Math.min(512, availableMemory * 0.8),
      });
    } else {
      return this.processFilesSequential(files, conversions, conversionFunctions, progressCallback);
    }
  }
}
