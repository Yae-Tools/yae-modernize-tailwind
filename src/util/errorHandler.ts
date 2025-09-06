import { ErrorContext } from '../types/conversionTypes.js';
import chalk from 'chalk';

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
  }
}

export class GitError extends ConversionError {
  constructor(message: string, suggestion?: string) {
    super(message, {
      type: 'git',
      message,
      suggestion,
    });
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

  /**
   * Initialize error tracking for a new processing session
   */
  static initSession(totalFiles: number): void {
    this.errorCounts = { file: 0, content: 0, git: 0, config: 0 };
    this.processedFiles = 0;
    this.totalFiles = totalFiles;
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
  static recordError(error: ConversionError): void {
    this.errorCounts[error.context.type]++;

    console.error(this.formatError(error));

    // Log to error report for later analysis
    this.logToErrorReport(error);
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
  private static logToErrorReport(error: ConversionError): void {
    // In a real implementation, this could write to a file or send to monitoring
    // For now, we'll just track in memory
  }

  /**
   * Update progress and file count
   */
  static incrementProcessedFiles(): void {
    this.processedFiles++;
  }

  /**
   * Generate final error report
   */
  static generateReport(): string {
    const totalErrors = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);
    const successRate =
      this.totalFiles > 0
        ? (((this.processedFiles - totalErrors) / this.totalFiles) * 100).toFixed(1)
        : '0.0';

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

    return report.join('\n');
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
    context: string,
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const conversionError = this.handleFileError(error, filePath);
      this.recordError(conversionError);

      if (!this.shouldContinueProcessing(conversionError)) {
        throw conversionError;
      }

      return null;
    }
  }

  /**
   * Safe content processing wrapper
   */
  static safeContentOperation<T>(
    operation: () => T,
    filePath: string,
    lineNumber?: number,
  ): T | null {
    try {
      return operation();
    } catch (error) {
      const conversionError = this.handleContentError(error, filePath, lineNumber);
      this.recordError(conversionError);

      if (!this.shouldContinueProcessing(conversionError)) {
        throw conversionError;
      }

      return null;
    }
  }
}
