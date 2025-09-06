import {
  ErrorContext,
  LoggingConfig,
  ErrorReport,
  SystemInfo,
  ErrorReportContext,
  SessionSummary,
  GitStatus,
} from '../types/conversionTypes.js';
import { LoggingConfigManager } from './loggingConfig.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced Error Handling System
 *
 * Provides comprehensive error classification, recovery strategies,
 * and user-friendly error reporting for the conversion process.
 */

export class ConversionError extends Error {
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;

  constructor(message: string, context: ErrorContext, recoverable = true) {
    super(message);
    this.name = 'ConversionError';
    this.context = context;
    this.recoverable = recoverable;
  }
}

export class FileSystemError extends ConversionError {
  constructor(message: string, filePath: string, code?: string, suggestion?: string) {
    super(message, {
      type: 'file',
      code,
      message,
      file: filePath,
      suggestion,
    });
    this.name = 'FileSystemError';
  }
}

export class ContentProcessingError extends ConversionError {
  constructor(
    message: string,
    filePath: string,
    line?: number,
    column?: number,
    suggestion?: string,
  ) {
    super(message, {
      type: 'content',
      message,
      file: filePath,
      line,
      column,
      suggestion,
    });
    this.name = 'ContentProcessingError';
  }
}

export class GitError extends ConversionError {
  constructor(message: string, suggestion?: string) {
    super(message, {
      type: 'git',
      message,
      suggestion,
    });
    this.name = 'GitError';
  }
}

export class ConfigurationError extends ConversionError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      {
        type: 'config',
        message,
        suggestion,
      },
      false,
    ); // Configuration errors are typically not recoverable
    this.name = 'ConfigurationError';
  }
}

/**
 * Error classification and handling utilities
 */
export class ErrorHandler {
  private static errorCounts = {
    file: 0,
    content: 0,
    git: 0,
    config: 0,
  };

  private static processedFiles = 0;
  private static totalFiles = 0;
  private static loggingConfig: LoggingConfig | null = null;
  private static sessionId: string = uuidv4();
  private static sessionStartTime: Date = new Date();
  private static memoryBuffer: ErrorReport[] = [];
  private static cliArguments: string[] = process.argv.slice(2);
  private static currentFile: string | undefined;
  private static gitStatus: GitStatus | undefined;
  private static sessionErrors: Map<string, number> = new Map();
  private static processingStartTime: number | undefined;

  /**
   * Initialize error tracking for a new processing session
   */
  static async initSession(totalFiles: number, gitStatus?: GitStatus): Promise<void> {
    this.errorCounts = { file: 0, content: 0, git: 0, config: 0 };
    this.processedFiles = 0;
    this.totalFiles = totalFiles;
    this.sessionId = uuidv4();
    this.sessionStartTime = new Date();
    this.memoryBuffer = [];
    this.sessionErrors = new Map();
    this.gitStatus = gitStatus;
    this.processingStartTime = Date.now();

    // Initialize logging configuration
    try {
      const cliOverrides = LoggingConfigManager.parseCLIOverrides(this.cliArguments);
      this.loggingConfig = await LoggingConfigManager.getConfig(cliOverrides);

      // Ensure log directory exists
      if (this.loggingConfig.enabled) {
        await this.ensureLogDirectory();
      }
    } catch (error) {
      console.warn(`Warning: Failed to initialize logging: ${(error as Error).message}`);
      this.loggingConfig = LoggingConfigManager.getDefaultConfig();
      this.loggingConfig.enabled = false;
    }
  }

  /**
   * Classify and handle file system errors
   */
  static handleFileError(error: unknown, filePath: string): ConversionError {
    const nodeError = error as NodeJS.ErrnoException;

    switch (nodeError.code) {
      case 'EACCES':
        return new FileSystemError(
          `Permission denied: Cannot read or write file`,
          filePath,
          'EACCES',
          'Check file permissions or run with appropriate privileges',
        );

      case 'ENOENT':
        return new FileSystemError(
          `File not found`,
          filePath,
          'ENOENT',
          'Verify the file path is correct and the file exists',
        );

      case 'EISDIR':
        return new FileSystemError(
          `Expected a file but found a directory`,
          filePath,
          'EISDIR',
          'Check that the path points to a file, not a directory',
        );

      case 'ENOSPC':
        return new FileSystemError(
          `Insufficient disk space`,
          filePath,
          'ENOSPC',
          'Free up disk space before continuing',
        );

      case 'EMFILE':
      case 'ENFILE':
        return new FileSystemError(
          `Too many open files`,
          filePath,
          nodeError.code,
          'Close other applications or increase system file limits',
        );

      default:
        return new FileSystemError(
          `File system error: ${nodeError.message}`,
          filePath,
          nodeError.code,
          'Check file system status and permissions',
        );
    }
  }

  /**
   * Handle content processing errors
   */
  static handleContentError(
    error: unknown,
    filePath: string,
    lineNumber?: number,
  ): ConversionError {
    if (error instanceof Error) {
      // Check for common content processing issues
      if (error.message.includes('Invalid UTF-8')) {
        return new ContentProcessingError(
          'File contains invalid UTF-8 encoding',
          filePath,
          lineNumber,
          undefined,
          'Convert file to UTF-8 encoding or skip binary files',
        );
      }

      if (error.message.includes('memory') || error.message.includes('allocation')) {
        return new ContentProcessingError(
          'File too large to process in memory',
          filePath,
          lineNumber,
          undefined,
          'Consider processing smaller files or increasing available memory',
        );
      }

      if (error.message.includes('regex') || error.message.includes('pattern')) {
        return new ContentProcessingError(
          'Regex pattern matching failed',
          filePath,
          lineNumber,
          undefined,
          'File may contain malformed class attributes',
        );
      }
    }

    return new ContentProcessingError(
      `Content processing failed: ${error instanceof Error ? error.message : String(error)}`,
      filePath,
      lineNumber,
      undefined,
      'Check file format and content structure',
    );
  }

  /**
   * Handle Git-related errors
   */
  static handleGitError(error: unknown): ConversionError {
    if (error instanceof Error) {
      if (error.message.includes('not a git repository')) {
        return new GitError(
          'Not a Git repository',
          'Use --ignore-git flag to skip Git checks or initialize Git repository',
        );
      }

      if (error.message.includes('git not found') || error.message.includes('command not found')) {
        return new GitError(
          'Git is not installed or not in PATH',
          'Install Git or use --ignore-git flag to skip Git checks',
        );
      }

      if (error.message.includes('uncommitted changes')) {
        return new GitError(
          'Repository has uncommitted changes',
          'Commit or stash changes before running, or use --ignore-git flag',
        );
      }
    }

    return new GitError(
      `Git operation failed: ${error instanceof Error ? error.message : String(error)}`,
      'Check Git status and configuration',
    );
  }

  /**
   * Record and report an error
   */
  static async recordError(error: ConversionError): Promise<void> {
    this.errorCounts[error.context.type]++;

    // Track error frequency
    const errorKey = `${error.context.type}:${error.message}`;
    this.sessionErrors.set(errorKey, (this.sessionErrors.get(errorKey) || 0) + 1);

    console.error(this.formatError(error));

    // Log to error report for later analysis
    await this.logToErrorReport(error);
  }

  /**
   * Format error message for console output
   */
  private static formatError(error: ConversionError): string {
    const icon = this.getErrorIcon(error.context.type);
    const location = error.context.file ? chalk.gray(`${error.context.file}`) : '';
    const lineInfo = error.context.line ? chalk.gray(`:${error.context.line}`) : '';
    const suggestion = error.context.suggestion
      ? `\n  ${chalk.yellow('💡 Suggestion:')} ${error.context.suggestion}`
      : '';

    return `${icon} ${chalk.red(error.message)}\n  ${location}${lineInfo}${suggestion}`;
  }

  /**
   * Get appropriate icon for error type
   */
  private static getErrorIcon(type: ErrorContext['type']): string {
    const icons = {
      file: '📁',
      content: '📄',
      git: '🔗',
      config: '⚙️',
    };
    return icons[type];
  }

  /**
   * Log error to report for analysis
   */
  private static async logToErrorReport(error: ConversionError): Promise<void> {
    if (!this.loggingConfig?.enabled) {
      return;
    }

    try {
      const errorReport = this.createErrorReport(error);

      if (this.loggingConfig.enableMemoryBuffer) {
        this.addToMemoryBuffer(errorReport);
      }

      await this.writeToLogFile(errorReport);
    } catch (logError) {
      // Prevent logging errors from crashing the application
      await this.handleLoggingFailure(logError as Error, error);
    }
  }

  /**
   * Create a comprehensive error report
   */
  private static createErrorReport(error: ConversionError): ErrorReport {
    return {
      sessionId: this.sessionId,
      timestamp: new Date(),
      error: this.serializeError(error),
      systemInfo: this.getSystemInfo(),
      context: this.getErrorContext(),
      severity: this.determineSeverity(error),
    };
  }

  /**
   * Serialize error for JSON storage
   */
  private static serializeError(error: ConversionError): {
    name: string;
    message: string;
    context: ErrorContext;
    recoverable: boolean;
    stack?: string;
  } {
    return {
      name: error.name,
      message: error.message,
      context: error.context,
      recoverable: error.recoverable,
      stack: error.stack,
    };
  }

  /**
   * Get current system information
   */
  private static getSystemInfo(): SystemInfo {
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cwd: process.cwd(),
    };
  }

  /**
   * Get current error context
   */
  private static getErrorContext(): ErrorReportContext {
    return {
      sessionStartTime: this.sessionStartTime,
      totalFiles: this.totalFiles,
      processedFiles: this.processedFiles,
      currentFile: this.currentFile,
      gitStatus: this.gitStatus,
      cliArguments: this.cliArguments,
    };
  }

  /**
   * Determine error severity based on type and context
   */
  private static determineSeverity(error: ConversionError): 'low' | 'medium' | 'high' | 'critical' {
    // Configuration errors are critical
    if (error.context.type === 'config') {
      return 'critical';
    }

    // Git errors are medium unless they block processing
    if (error.context.type === 'git') {
      return error.recoverable ? 'medium' : 'high';
    }

    // File system errors severity depends on the specific error
    if (error.context.type === 'file') {
      const code = error.context.code;
      if (code === 'ENOSPC' || code === 'EMFILE' || code === 'ENFILE') {
        return 'high';
      }
      return 'medium';
    }

    // Content errors are generally low severity
    return 'low';
  }

  /**
   * Add error report to memory buffer
   */
  private static addToMemoryBuffer(report: ErrorReport): void {
    if (!this.loggingConfig) return;

    this.memoryBuffer.push(report);

    // Trim buffer if it exceeds size limit
    if (this.memoryBuffer.length > this.loggingConfig.bufferSize) {
      this.memoryBuffer = this.memoryBuffer.slice(-this.loggingConfig.bufferSize);
    }
  }

  /**
   * Write error report to log file
   */
  private static async writeToLogFile(report: ErrorReport): Promise<void> {
    if (!this.loggingConfig) return;

    const logFile = this.getCurrentLogFile();
    const logEntry = JSON.stringify(report) + '\n';

    await fs.appendFile(logFile, logEntry, 'utf8');

    // Check if log rotation is needed
    await this.rotateLogsIfNeeded(logFile);
  }

  /**
   * Get current log file path
   */
  private static getCurrentLogFile(): string {
    if (!this.loggingConfig) {
      throw new Error('Logging config not initialized');
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.loggingConfig.logDirectory, `error-${today}.jsonl`);
  }

  /**
   * Ensure log directory exists
   */
  private static async ensureLogDirectory(): Promise<void> {
    if (!this.loggingConfig) return;

    try {
      await fs.mkdir(this.loggingConfig.logDirectory, { recursive: true });

      // Set appropriate permissions (700 = owner read/write/execute only)
      await fs.chmod(this.loggingConfig.logDirectory, 0o700);
    } catch (error) {
      throw new Error(`Failed to create log directory: ${(error as Error).message}`);
    }
  }

  /**
   * Handle logging system failures gracefully
   */
  private static async handleLoggingFailure(
    logError: Error,
    originalError: ConversionError,
  ): Promise<void> {
    // Fallback 1: Try memory buffer only
    if (
      this.loggingConfig?.enableMemoryBuffer &&
      this.memoryBuffer.length < this.loggingConfig.bufferSize
    ) {
      try {
        const report = this.createErrorReport(originalError);
        this.memoryBuffer.push(report);
        return;
      } catch {
        // Fallback failed, continue to next fallback
      }
    }

    // Fallback 2: Console warning (non-blocking)
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`⚠️  Logging system unavailable: ${logError.message}`);
    }

    // Fallback 3: Silent degradation - continue without logging
    // This prevents cascading failures from the logging system
  }

  /**
   * Update progress and file count
   */
  static incrementProcessedFiles(): void {
    this.processedFiles++;
  }

  /**
   * Set current file being processed (for context)
   */
  static setCurrentFile(filePath: string): void {
    this.currentFile = filePath;
  }

  /**
   * Clear current file (when processing completes)
   */
  static clearCurrentFile(): void {
    this.currentFile = undefined;
  }

  /**
   * Rotate log files if size limit exceeded
   */
  private static async rotateLogsIfNeeded(logFile: string): Promise<void> {
    if (!this.loggingConfig) return;

    try {
      const stats = await fs.stat(logFile);

      if (stats.size >= this.loggingConfig.maxLogSizeBytes) {
        // Create rotated file name with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = path.extname(logFile);
        const base = path.basename(logFile, ext);
        const dir = path.dirname(logFile);
        const rotatedFile = path.join(dir, `${base}-${timestamp}${ext}`);

        // Rename current file
        await fs.rename(logFile, rotatedFile);
      }

      // Clean up old log files
      await this.cleanupOldLogs();
    } catch (error) {
      // Log rotation failure shouldn't crash the application
      console.warn(`Warning: Log rotation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up old log files based on retention policy
   */
  private static async cleanupOldLogs(): Promise<void> {
    if (!this.loggingConfig) return;

    try {
      const files = await fs.readdir(this.loggingConfig.logDirectory);
      const logFiles = files
        .filter((file) => file.startsWith('error-') && file.endsWith('.jsonl'))
        .map((file) => ({
          name: file,
          path: path.join(this.loggingConfig!.logDirectory, file),
        }));

      // Get file stats with modification times
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const stats = await fs.stat(file.path);
          return { ...file, mtime: stats.mtime };
        }),
      );

      // Sort by modification time (newest first)
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove files beyond the retention limit
      const filesToDelete = fileStats.slice(this.loggingConfig.maxLogFiles);

      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
        } catch (error) {
          console.warn(
            `Warning: Failed to delete old log file ${file.name}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      console.warn(`Warning: Log cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate final error report
   */
  static async generateReport(): Promise<string> {
    const totalErrors = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);
    const successRate =
      this.totalFiles > 0
        ? (((this.processedFiles - totalErrors) / this.totalFiles) * 100).toFixed(1)
        : '0.0';

    // Generate session summary if logging is enabled
    if (this.loggingConfig?.enabled) {
      try {
        await this.generateSessionSummary();
        await this.flushMemoryBuffer();
      } catch (error) {
        console.warn(`Warning: Failed to generate session summary: ${(error as Error).message}`);
      }
    }

    if (totalErrors === 0) {
      return chalk.green(
        `✅ All ${this.processedFiles} files processed successfully! (${successRate}% success rate)`,
      );
    }

    const report = [
      chalk.yellow(`\n📊 Processing Summary:`),
      `  Total files: ${this.totalFiles}`,
      `  Processed: ${this.processedFiles}`,
      `  Success rate: ${successRate}%`,
      '',
      chalk.yellow('📋 Error Breakdown:'),
    ];

    Object.entries(this.errorCounts).forEach(([type, count]) => {
      if (count > 0) {
        report.push(`  ${this.getErrorIcon(type as ErrorContext['type'])} ${type}: ${count}`);
      }
    });

    // Add recommendations if available
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      report.push('', chalk.yellow('💡 Recommendations:'));
      recommendations.forEach((rec) => report.push(`  • ${rec}`));
    }

    return report.join('\n');
  }

  /**
   * Generate session summary and save to file
   */
  private static async generateSessionSummary(): Promise<void> {
    if (!this.loggingConfig) return;

    const endTime = new Date();
    const duration = endTime.getTime() - this.sessionStartTime.getTime();
    const totalErrors = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);

    // Calculate error frequencies by type and file
    const errorsByType: Record<string, number> = { ...this.errorCounts };
    const errorsByFile: Record<string, number> = {};

    // Process memory buffer to get file-specific error counts
    this.memoryBuffer.forEach((report) => {
      const file = report.context.currentFile || 'unknown';
      errorsByFile[file] = (errorsByFile[file] || 0) + 1;
    });

    const summary: SessionSummary = {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      endTime,
      duration,
      filesProcessed: this.processedFiles,
      totalErrors,
      errorsByType,
      errorsByFile,
      systemPerformance: {
        peakMemoryUsage: this.getPeakMemoryUsage(),
        averageProcessingTime: this.getAverageProcessingTime(),
      },
      recommendations: this.generateRecommendations(),
    };

    // Save summary to file
    const summaryFile = path.join(this.loggingConfig.logDirectory, 'session-summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
  }

  /**
   * Flush memory buffer to disk
   */
  private static async flushMemoryBuffer(): Promise<void> {
    if (!this.loggingConfig?.enableMemoryBuffer || this.memoryBuffer.length === 0) {
      return;
    }

    try {
      const logFile = this.getCurrentLogFile();
      const logEntries =
        this.memoryBuffer.map((report) => JSON.stringify(report)).join('\n') + '\n';

      await fs.appendFile(logFile, logEntries, 'utf8');
      this.memoryBuffer = []; // Clear buffer after successful write
    } catch (error) {
      console.warn(`Warning: Failed to flush memory buffer: ${(error as Error).message}`);
    }
  }

  /**
   * Generate recommendations based on error patterns
   */
  private static generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // File permission issues
    if (this.errorCounts.file > 0) {
      recommendations.push('Check file permissions and ensure the tool has read/write access');
    }

    // Git issues
    if (this.errorCounts.git > 0) {
      recommendations.push('Consider using --ignore-git flag if Git integration is not needed');
    }

    // High error rate
    const totalErrors = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);
    const errorRate = this.totalFiles > 0 ? (totalErrors / this.totalFiles) * 100 : 0;

    if (errorRate > 50) {
      recommendations.push('High error rate detected - consider running on a smaller subset first');
    }

    // Memory issues
    if (this.hasMemoryIssues()) {
      recommendations.push('Consider processing files in smaller batches to reduce memory usage');
    }

    return recommendations;
  }

  /**
   * Get peak memory usage during session
   */
  private static getPeakMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }

  /**
   * Get average processing time per file
   */
  private static getAverageProcessingTime(): number {
    if (!this.processingStartTime || this.processedFiles === 0) {
      return 0;
    }

    const totalTime = Date.now() - this.processingStartTime;
    return totalTime / this.processedFiles;
  }

  /**
   * Check if there are memory-related issues
   */
  private static hasMemoryIssues(): boolean {
    // Check if any errors mention memory
    return this.memoryBuffer.some(
      (report) =>
        report.error.message.toLowerCase().includes('memory') ||
        report.error.message.toLowerCase().includes('allocation'),
    );
  }

  /**
   * Determine if processing should continue based on error type and count
   */
  static shouldContinueProcessing(error: ConversionError): boolean {
    // Stop processing for non-recoverable errors
    if (!error.recoverable) {
      return false;
    }

    // Stop if too many errors of the same type
    const errorThreshold = 10;
    return this.errorCounts[error.context.type] < errorThreshold;
  }

  /**
   * Safe file operation wrapper
   */
  static async safeFileOperation<T>(
    operation: () => Promise<T>,
    filePath: string,
    _context: string,
  ): Promise<T | null> {
    this.setCurrentFile(filePath);

    try {
      return await operation();
    } catch (error) {
      const conversionError = this.handleFileError(error, filePath);
      await this.recordError(conversionError);

      if (!this.shouldContinueProcessing(conversionError)) {
        throw conversionError;
      }

      return null;
    } finally {
      this.clearCurrentFile();
    }
  }

  /**
   * Safe content processing wrapper
   */
  static async safeContentOperation<T>(
    operation: () => T,
    filePath: string,
    lineNumber?: number,
  ): Promise<T | null> {
    this.setCurrentFile(filePath);

    try {
      return operation();
    } catch (error) {
      const conversionError = this.handleContentError(error, filePath, lineNumber);
      await this.recordError(conversionError);

      if (!this.shouldContinueProcessing(conversionError)) {
        throw conversionError;
      }

      return null;
    } finally {
      this.clearCurrentFile();
    }
  }

  /**
   * Get current logging configuration
   */
  static getLoggingConfig(): LoggingConfig | null {
    return this.loggingConfig;
  }

  /**
   * Get session statistics
   */
  static getSessionStats() {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      processedFiles: this.processedFiles,
      totalFiles: this.totalFiles,
      errorCounts: { ...this.errorCounts },
      memoryBufferSize: this.memoryBuffer.length,
    };
  }

  /**
   * Export memory buffer for testing/debugging
   */
  static getMemoryBuffer(): ErrorReport[] {
    return [...this.memoryBuffer];
  }

  /**
   * Force flush memory buffer (for testing)
   */
  static async forceFlushBuffer(): Promise<void> {
    await this.flushMemoryBuffer();
  }
}
