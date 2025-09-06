import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, ConversionError, FileSystemError, ContentProcessingError, GitError, ConfigurationError } from '../../src/util/errorHandler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Reset error handler state before each test
    ErrorHandler.initSession(10);
    
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Classification', () => {
    describe('handleFileError', () => {
      it('should classify EACCES as permission error', () => {
        const nodeError = { code: 'EACCES', message: 'Permission denied' } as NodeJS.ErrnoException;
        const error = ErrorHandler.handleFileError(nodeError, '/test/file.js');
        
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error.context.code).toBe('EACCES');
        expect(error.context.suggestion).toContain('permission');
      });

      it('should classify ENOENT as file not found error', () => {
        const nodeError = { code: 'ENOENT', message: 'File not found' } as NodeJS.ErrnoException;
        const error = ErrorHandler.handleFileError(nodeError, '/test/file.js');
        
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error.context.code).toBe('ENOENT');
        expect(error.context.suggestion).toContain('file path');
      });

      it('should classify EISDIR as directory error', () => {
        const nodeError = { code: 'EISDIR', message: 'Is a directory' } as NodeJS.ErrnoException;
        const error = ErrorHandler.handleFileError(nodeError, '/test/directory');
        
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error.context.code).toBe('EISDIR');
        expect(error.context.suggestion).toContain('directory');
      });

      it('should classify ENOSPC as disk space error', () => {
        const nodeError = { code: 'ENOSPC', message: 'No space left' } as NodeJS.ErrnoException;
        const error = ErrorHandler.handleFileError(nodeError, '/test/file.js');
        
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error.context.code).toBe('ENOSPC');
        expect(error.context.suggestion).toContain('disk space');
      });

      it('should handle unknown file system errors', () => {
        const nodeError = { code: 'UNKNOWN', message: 'Unknown error' } as NodeJS.ErrnoException;
        const error = ErrorHandler.handleFileError(nodeError, '/test/file.js');
        
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error.context.code).toBe('UNKNOWN');
        expect(error.message).toContain('Unknown error');
      });
    });

    describe('handleContentError', () => {
      it('should classify UTF-8 errors', () => {
        const error = new Error('Invalid UTF-8 sequence');
        const contentError = ErrorHandler.handleContentError(error, '/test/file.js', 42);
        
        expect(contentError).toBeInstanceOf(ContentProcessingError);
        expect(contentError.context.line).toBe(42);
        expect(contentError.context.suggestion).toContain('UTF-8');
      });

      it('should classify memory errors', () => {
        const error = new Error('JavaScript heap out of memory');
        const contentError = ErrorHandler.handleContentError(error, '/test/large-file.js');
        
        expect(contentError).toBeInstanceOf(ContentProcessingError);
        expect(contentError.context.suggestion).toContain('memory');
      });

      it('should classify regex errors', () => {
        const error = new Error('Invalid regex pattern');
        const contentError = ErrorHandler.handleContentError(error, '/test/file.js');
        
        expect(contentError).toBeInstanceOf(ContentProcessingError);
        expect(contentError.context.suggestion).toContain('malformed');
      });

      it('should handle generic content errors', () => {
        const error = new Error('Generic processing error');
        const contentError = ErrorHandler.handleContentError(error, '/test/file.js');
        
        expect(contentError).toBeInstanceOf(ContentProcessingError);
        expect(contentError.message).toContain('Generic processing error');
      });
    });

    describe('handleGitError', () => {
      it('should classify \"not a git repository\" errors', () => {
        const error = new Error('fatal: not a git repository');
        const gitError = ErrorHandler.handleGitError(error);
        
        expect(gitError).toBeInstanceOf(GitError);
        expect(gitError.context.suggestion).toContain('--ignore-git');
      });

      it('should classify git not found errors', () => {
        const error = new Error('git: command not found');
        const gitError = ErrorHandler.handleGitError(error);
        
        expect(gitError).toBeInstanceOf(GitError);
        expect(gitError.context.suggestion).toContain('Install Git');
      });

      it('should classify uncommitted changes errors', () => {
        const error = new Error('You have uncommitted changes');
        const gitError = ErrorHandler.handleGitError(error);
        
        expect(gitError).toBeInstanceOf(GitError);
        expect(gitError.context.suggestion).toContain('Commit or stash');
      });
    });
  });

  describe('Error Recording and Reporting', () => {
    it('should record and count errors by type', () => {
      const fileError = new FileSystemError('Test file error', '/test/file.js');
      const contentError = new ContentProcessingError('Test content error', '/test/file.js');
      
      ErrorHandler.recordError(fileError);
      ErrorHandler.recordError(contentError);
      
      const report = ErrorHandler.generateReport();
      expect(report).toContain('file: 1');
      expect(report).toContain('content: 1');
    });

    it('should generate success report when no errors', () => {
      // Process some files successfully
      for (let i = 0; i < 5; i++) {
        ErrorHandler.incrementProcessedFiles();
      }
      
      const report = ErrorHandler.generateReport();
      expect(report).toContain('✅');
      expect(report).toContain('successfully');
    });

    it('should calculate correct success rate', () => {
      // Process 8 files successfully, 2 with errors
      for (let i = 0; i < 10; i++) {
        ErrorHandler.incrementProcessedFiles();
      }
      
      const error1 = new FileSystemError('Error 1', '/test/file1.js');
      const error2 = new ContentProcessingError('Error 2', '/test/file2.js');
      ErrorHandler.recordError(error1);
      ErrorHandler.recordError(error2);
      
      const report = ErrorHandler.generateReport();
      expect(report).toContain('80.0%'); // 8/10 = 80%
    });
  });

  describe('Error Recovery and Control Flow', () => {
    it('should determine recoverability correctly', () => {
      const recoverableError = new FileSystemError('Recoverable', '/test/file.js');
      const nonRecoverableError = new ConfigurationError('Non-recoverable');
      
      expect(recoverableError.recoverable).toBe(true);
      expect(nonRecoverableError.recoverable).toBe(false);
    });

    it('should stop processing after too many errors of same type', () => {
      // Record 11 file errors (threshold is 10)
      for (let i = 0; i < 11; i++) {
        const error = new FileSystemError(`Error ${i}`, `/test/file${i}.js`);
        ErrorHandler.recordError(error);
      }
      
      const testError = new FileSystemError('Test error', '/test/test.js');
      const shouldContinue = ErrorHandler.shouldContinueProcessing(testError);
      expect(shouldContinue).toBe(false);
    });

    it('should continue processing with recoverable errors under threshold', () => {
      const error = new FileSystemError('Test error', '/test/file.js');
      ErrorHandler.recordError(error);
      
      const shouldContinue = ErrorHandler.shouldContinueProcessing(error);
      expect(shouldContinue).toBe(true);
    });

    it('should stop processing with non-recoverable errors', () => {
      const error = new ConfigurationError('Fatal config error');
      const shouldContinue = ErrorHandler.shouldContinueProcessing(error);
      expect(shouldContinue).toBe(false);
    });
  });

  describe('Safe Operation Wrappers', () => {
    describe('safeFileOperation', () => {
      it('should execute successful operations', async () => {
        const operation = vi.fn().mockResolvedValue('success');
        const result = await ErrorHandler.safeFileOperation(operation, '/test/file.js', 'test');
        
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledOnce();
      });

      it('should handle file operation errors', async () => {
        const operation = vi.fn().mockRejectedValue({ code: 'ENOENT', message: 'File not found' });
        const result = await ErrorHandler.safeFileOperation(operation, '/test/file.js', 'test');
        
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });

      it('should throw on non-recoverable errors', async () => {
        // Mock shouldContinueProcessing to return false
        const originalMethod = ErrorHandler.shouldContinueProcessing;
        ErrorHandler.shouldContinueProcessing = vi.fn().mockReturnValue(false);
        
        const operation = vi.fn().mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });
        
        await expect(ErrorHandler.safeFileOperation(operation, '/test/file.js', 'test'))
          .rejects.toThrow();
        
        // Restore original method
        ErrorHandler.shouldContinueProcessing = originalMethod;
      });
    });

    describe('safeContentOperation', () => {
      it('should execute successful operations', () => {
        const operation = vi.fn().mockReturnValue('success');
        const result = ErrorHandler.safeContentOperation(operation, '/test/file.js');
        
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledOnce();
      });

      it('should handle content operation errors', () => {
        const operation = vi.fn().mockImplementation(() => {
          throw new Error('Processing failed');
        });
        const result = ErrorHandler.safeContentOperation(operation, '/test/file.js', 42);
        
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });

      it('should throw on non-recoverable errors', () => {
        // Mock shouldContinueProcessing to return false
        const originalMethod = ErrorHandler.shouldContinueProcessing;
        ErrorHandler.shouldContinueProcessing = vi.fn().mockReturnValue(false);
        
        const operation = vi.fn().mockImplementation(() => {
          throw new Error('Fatal error');
        });
        
        expect(() => ErrorHandler.safeContentOperation(operation, '/test/file.js'))
          .toThrow();
        
        // Restore original method
        ErrorHandler.shouldContinueProcessing = originalMethod;
      });
    });
  });

  describe('Error Message Formatting', () => {
    it('should format file system errors with location info', () => {
      const error = new FileSystemError('Test error', '/long/path/to/file.js', 'ENOENT', 'Check file path');
      ErrorHandler.recordError(error);
      
      expect(console.error).toHaveBeenCalled();
      const call = (console.error as any).mock.calls[0][0];
      expect(call).toContain('/long/path/to/file.js');
      expect(call).toContain('Check file path');
    });

    it('should format content errors with line info', () => {
      const error = new ContentProcessingError('Test error', '/test/file.js', 42, 10, 'Fix syntax');
      ErrorHandler.recordError(error);
      
      expect(console.error).toHaveBeenCalled();
      const call = (console.error as any).mock.calls[0][0];
      expect(call).toContain(':42');
      expect(call).toContain('Fix syntax');
    });

    it('should use appropriate icons for error types', () => {
      const fileError = new FileSystemError('File error', '/test/file.js');
      const contentError = new ContentProcessingError('Content error', '/test/file.js');
      const gitError = new GitError('Git error');
      const configError = new ConfigurationError('Config error');
      
      ErrorHandler.recordError(fileError);
      ErrorHandler.recordError(contentError);
      ErrorHandler.recordError(gitError);
      ErrorHandler.recordError(configError);
      
      expect(console.error).toHaveBeenCalledTimes(4);
      // Icons should be different for each error type
      const calls = (console.error as any).mock.calls.map((call: any) => call[0]);
      expect(calls[0]).toContain('📁'); // File error
      expect(calls[1]).toContain('📄'); // Content error
      expect(calls[2]).toContain('🔗'); // Git error
      expect(calls[3]).toContain('⚙️'); // Config error
    });
  });

  describe('Session Management', () => {
    it('should initialize session with correct file count', () => {
      ErrorHandler.initSession(25);
      
      // Process all files successfully
      for (let i = 0; i < 25; i++) {
        ErrorHandler.incrementProcessedFiles();
      }
      
      const report = ErrorHandler.generateReport();
      expect(report).toContain('25 files');
      expect(report).toContain('100.0%');
    });

    it('should reset error counts between sessions', () => {
      // First session with errors
      ErrorHandler.initSession(5);
      const error1 = new FileSystemError('Error 1', '/test/file1.js');
      ErrorHandler.recordError(error1);
      
      // Second session should start fresh
      ErrorHandler.initSession(3);
      for (let i = 0; i < 3; i++) {
        ErrorHandler.incrementProcessedFiles();
      }
      
      const report = ErrorHandler.generateReport();
      expect(report).toContain('✅'); // Should show success
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined errors gracefully', () => {
      const contentError1 = ErrorHandler.handleContentError(null, '/test/file.js');
      const contentError2 = ErrorHandler.handleContentError(undefined, '/test/file.js');
      
      expect(contentError1).toBeInstanceOf(ContentProcessingError);
      expect(contentError2).toBeInstanceOf(ContentProcessingError);
    });

    it('should handle empty file paths', () => {
      const error = new Error('Test error');
      const fileError = ErrorHandler.handleFileError(error, '');
      
      expect(fileError.context.file).toBe('');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);
      const contentError = ErrorHandler.handleContentError(error, '/test/file.js');
      
      expect(contentError.message).toContain(longMessage);
    });

    it('should handle unicode characters in file paths', () => {
      const unicodePath = '/测试/文件/📁/test.js';
      const error = { code: 'ENOENT', message: 'File not found' } as NodeJS.ErrnoException;
      const fileError = ErrorHandler.handleFileError(error, unicodePath);
      
      expect(fileError.context.file).toBe(unicodePath);
    });
  });
});