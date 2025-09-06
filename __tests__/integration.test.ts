import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Mock external dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({
      selectedConversions: ['size', 'margin', 'padding'],
      continue: true,
    }),
  },
}));

vi.mock('simple-git', () => ({
  simpleGit: () => ({
    status: vi.fn().mockResolvedValue({ isClean: () => true }),
  }),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

// Mock yargs to provide controlled command line arguments
let mockArgv = {
  conversions: ['size', 'margin'],
  path: '**/*.{html,jsx,tsx}',
  ignoreGit: false,
};

vi.mock('yargs', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    option: vi.fn().mockReturnThis(),
    help: vi.fn().mockReturnThis(),
    get argv() {
      return Promise.resolve(mockArgv);
    },
  })),
}));

vi.mock('yargs/helpers', () => ({
  hideBin: vi.fn(),
}));

// Mock environment detection
vi.mock('../../src/environment', () => ({
  detectEnvironment: vi.fn().mockResolvedValue('React'),
  getTailwindVersion: vi.fn().mockResolvedValue('3.4.0'),
  shouldShowTailwindWarning: vi.fn().mockReturnValue(false),
}));

// Mock exit message
vi.mock('../../src/util/exitMessage', () => ({
  exitMessage: vi.fn(),
}));

// Mock process methods
const originalCwd = process.cwd;
const originalStdout = process.stdout;
const originalProcessExit = process.exit;

describe('Integration Tests', () => {
  let tempDir: string;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  const importRun = async () => {
    // Clear modules to ensure fresh imports with mocks
    vi.resetModules();
    const module = await import('../src/index');
    return module.run;
  };

  beforeEach(async () => {
    // Create temporary directory
    tempDir = join(tmpdir(), `yae-integration-${randomBytes(8).toString('hex')}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Mock process.cwd to return our temp directory
    process.cwd = vi.fn().mockReturnValue(tempDir);
    
    // Mock process.exit to prevent test termination
    process.exit = vi.fn() as any;
    
    // Mock stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    });

    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(async () => {
    // Restore original methods
    process.cwd = originalCwd;
    process.exit = originalProcessExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    vi.clearAllMocks();
  });

  describe('End-to-End File Processing', () => {
    it('should process HTML files with size conversions', async () => {
      // Create test files
      const htmlFile = join(tempDir, 'test.html');
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class=\"w-4 h-4 text-red-500\">Square element</div>
          <div class=\"w-2 h-4\">Rectangle element</div>
          <div class=\"w-8 h-8 bg-blue-500\">Large square</div>
        </body>
        </html>
      `;
      await fs.writeFile(htmlFile, htmlContent, 'utf-8');

      // Update mock argv for this specific test
      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.html'),
        ignoreGit: true,
      };

      // Run the conversion
      const run = await importRun();
      await run();

      // Check the results
      const processedContent = await fs.readFile(htmlFile, 'utf-8');
      expect(processedContent).toContain('size-4');
      expect(processedContent).toContain('size-8');
      expect(processedContent).toContain('w-2 h-4'); // Should remain unchanged
      expect(processedContent).toContain('text-red-500');
      expect(processedContent).toContain('bg-blue-500');
    });

    it('should process React JSX files with className conversions', async () => {
      // Create React component file
      const jsxFile = join(tempDir, 'Component.jsx');
      const jsxContent = `
        import React from 'react';
        
        const Component = () => {
          return (
            <div>
              <div className=\"w-6 h-6 border\">Icon</div>
              <span className={\"w-4 h-4 bg-gray-200\"}>Badge</span>
              <button className=\"px-4 py-2 w-full h-12\">Button</button>
            </div>
          );
        };
        
        export default Component;
      `;
      await fs.writeFile(jsxFile, jsxContent, 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.jsx'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const processedContent = await fs.readFile(jsxFile, 'utf-8');
      expect(processedContent).toContain('size-6');
      expect(processedContent).toContain('size-4');
      expect(processedContent).toContain('w-full h-12'); // Different values, should not convert
      expect(processedContent).toContain('px-4 py-2');
    });

    it('should process Vue files with :class bindings', async () => {
      // Create Vue component file
      const vueFile = join(tempDir, 'Component.vue');
      const vueContent = `
        <template>
          <div>
            <div :class=\"w-4 h-4 rounded\">Dynamic classes</div>
            <div class=\"w-8 h-8 shadow\">Static classes</div>
            <span v-bind:class=\"w-2 h-2 inline-block\">Bound classes</span>
          </div>
        </template>
        
        <script>
        export default {
          name: 'Component'
        }
        </script>
      `;
      await fs.writeFile(vueFile, vueContent, 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.vue'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const processedContent = await fs.readFile(vueFile, 'utf-8');
      expect(processedContent).toContain('size-4');
      expect(processedContent).toContain('size-8');
      expect(processedContent).toContain('size-2');
    });

    it('should process multiple conversion types', async () => {
      // Create file with margin, padding, and size classes
      const htmlFile = join(tempDir, 'multi.html');
      const htmlContent = `
        <div class=\"mx-4 my-4 px-2 py-2 w-6 h-6\">
          Multiple conversion types
        </div>
        <div class=\"mx-8 my-6 px-4 py-4 w-10 h-8\">
          Mixed values - some should convert
        </div>
      `;
      await fs.writeFile(htmlFile, htmlContent, 'utf-8');

      mockArgv = {
        conversions: ['size', 'margin', 'padding'],
        path: join(tempDir, '*.html'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const processedContent = await fs.readFile(htmlFile, 'utf-8');
      expect(processedContent).toContain('m-4'); // mx-4 my-4 -> m-4
      expect(processedContent).toContain('p-2'); // px-2 py-2 -> p-2
      expect(processedContent).toContain('size-6'); // w-6 h-6 -> size-6
      expect(processedContent).toContain('mx-8 my-6'); // Different values, no conversion
      expect(processedContent).toContain('p-4'); // px-4 py-4 -> p-4
      expect(processedContent).toContain('w-10 h-8'); // Different values, no conversion
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle files with permission errors gracefully', async () => {
      // Create a file and try to make it unreadable (may not work on all systems)
      const restrictedFile = join(tempDir, 'restricted.html');
      await fs.writeFile(restrictedFile, '<div class=\"w-4 h-4\">Content</div>', 'utf-8');
      
      try {
        await fs.chmod(restrictedFile, 0o000); // Remove all permissions
      } catch (error) {
        // If we can't change permissions, skip this test
        return;
      }

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.html'),
        ignoreGit: true,
      };

      // Should not throw, but should handle error gracefully
      const run = await importRun();
      await expect(run()).resolves.not.toThrow();

      // Restore permissions for cleanup
      try {
        await fs.chmod(restrictedFile, 0o644);
      } catch (error) {
        // Ignore restore errors
      }
    });

    it('should handle malformed HTML gracefully', async () => {
      // Create file with malformed HTML
      const malformedFile = join(tempDir, 'malformed.html');
      const malformedContent = `
        <div class=\"w-4 h-4>Unclosed quote
        <span class=\"w-2 h-2\" invalid-attribute>Malformed attributes</span>
        <div class=\"w-6 h-6\">Valid content</div>
      `;
      await fs.writeFile(malformedFile, malformedContent, 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.html'),
        ignoreGit: true,
      };

      const run = await importRun();
      await expect(run()).resolves.not.toThrow();

      const processedContent = await fs.readFile(malformedFile, 'utf-8');
      expect(processedContent).toContain('size-6'); // Valid content should still be processed
    });

    it('should handle empty and binary files', async () => {
      // Create empty file
      const emptyFile = join(tempDir, 'empty.html');
      await fs.writeFile(emptyFile, '', 'utf-8');

      // Create binary file
      const binaryFile = join(tempDir, 'binary.html');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
      await fs.writeFile(binaryFile, binaryData);

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.html'),
        ignoreGit: true,
      };

      const run = await importRun();
      await expect(run()).resolves.not.toThrow();
    });
  });

  describe('Performance with Large Codebases', () => {
    it('should handle large numbers of files efficiently', async () => {
      const fileCount = 50;
      const files: string[] = [];

      // Create many files
      for (let i = 0; i < fileCount; i++) {
        const fileName = join(tempDir, `file-${i}.html`);
        const content = `
          <div class=\"w-${i % 10} h-${i % 10} p-2\">
            File ${i} content
          </div>
        `;
        await fs.writeFile(fileName, content, 'utf-8');
        files.push(fileName);
      }

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.html'),
        ignoreGit: true,
      };

      const startTime = Date.now();
      const run = await importRun();
      await run();
      const endTime = Date.now();

      // Should complete within reasonable time (adjust as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Verify some conversions were applied
      const processedFiles = await Promise.all(
        files.slice(0, 5).map(file => fs.readFile(file, 'utf-8'))
      );
      
      const hasConversions = processedFiles.some(content => content.includes('size-'));
      expect(hasConversions).toBe(true);
    }, 10000); // 10 second timeout

    it('should handle files with large class lists', async () => {
      // Create file with many classes
      const largeClassList = Array(100).fill(0).map((_, i) => `class-${i}`).join(' ');
      const largeFile = join(tempDir, 'large-classes.html');
      const largeContent = `
        <div class=\"${largeClassList} w-4 h-4\">
          Element with many classes
        </div>
      `;
      await fs.writeFile(largeFile, largeContent, 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, 'large-classes.html'),
        ignoreGit: true,
      };

      const startTime = Date.now();
      const run = await importRun();
      await run();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should be fast

      const processedContent = await fs.readFile(largeFile, 'utf-8');
      expect(processedContent).toContain('size-4');
      expect(processedContent).toContain('class-0');
      expect(processedContent).toContain('class-99');
    });
  });

  describe('Configuration and CLI Integration', () => {
    it('should respect glob patterns', async () => {
      // Create files with different extensions
      await fs.writeFile(join(tempDir, 'test.html'), '<div class=\"w-4 h-4\">HTML</div>', 'utf-8');
      await fs.writeFile(join(tempDir, 'test.jsx'), '<div className=\"w-4 h-4\">JSX</div>', 'utf-8');
      await fs.writeFile(join(tempDir, 'test.txt'), 'w-4 h-4', 'utf-8'); // Should not be processed

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.{html,jsx}'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const htmlContent = await fs.readFile(join(tempDir, 'test.html'), 'utf-8');
      const jsxContent = await fs.readFile(join(tempDir, 'test.jsx'), 'utf-8');
      const txtContent = await fs.readFile(join(tempDir, 'test.txt'), 'utf-8');

      expect(htmlContent).toContain('size-4');
      expect(jsxContent).toContain('size-4');
      expect(txtContent).toBe('w-4 h-4'); // Should be unchanged
    });

    it('should ignore node_modules by default', async () => {
      // Create node_modules directory with files
      const nodeModulesDir = join(tempDir, 'node_modules', 'some-package');
      await fs.mkdir(nodeModulesDir, { recursive: true });
      
      const packageFile = join(nodeModulesDir, 'index.html');
      await fs.writeFile(packageFile, '<div class=\"w-4 h-4\">Package</div>', 'utf-8');

      // Create regular file that should be processed
      const regularFile = join(tempDir, 'app.html');
      await fs.writeFile(regularFile, '<div class=\"w-4 h-4\">App</div>', 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '**/*.html'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const packageContent = await fs.readFile(packageFile, 'utf-8');
      const regularContent = await fs.readFile(regularFile, 'utf-8');

      expect(packageContent).toBe('<div class=\"w-4 h-4\">Package</div>'); // Should be unchanged
      expect(regularContent).toContain('size-4'); // Should be processed
    });
  });

  describe('Framework-Specific Processing', () => {
    it('should handle TypeScript React files', async () => {
      const tsxFile = join(tempDir, 'Component.tsx');
      const tsxContent = `
        import React from 'react';
        
        interface Props {
          className?: string;
        }
        
        const Component: React.FC<Props> = ({ className }) => {
          return (
            <div className={"w-4 h-4 " + (className || "")}>
              <span className="w-8 h-8 bg-blue-500">Icon</span>
            </div>
          );
        };
        
        export default Component;
      `;
      await fs.writeFile(tsxFile, tsxContent, 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.tsx'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const processedContent = await fs.readFile(tsxFile, 'utf-8');
      expect(processedContent).toContain('w-4 h-4'); // Complex expression should remain unchanged
      expect(processedContent).toContain('size-8');
    });

    it('should handle Svelte files', async () => {
      const svelteFile = join(tempDir, 'Component.svelte');
      const svelteContent = `
        <script>
          export let active = false;
        </script>
        
        <div class=\"w-6 h-6 {active ? 'bg-blue-500' : 'bg-gray-300'}\">
          <span class=\"w-4 h-4 inline-block\">Icon</span>
        </div>
        
        <style>
          /* Component styles */
        </style>
      `;
      await fs.writeFile(svelteFile, svelteContent, 'utf-8');

      mockArgv = {
        conversions: ['size'],
        path: join(tempDir, '*.svelte'),
        ignoreGit: true,
      };

      const run = await importRun();
      await run();

      const processedContent = await fs.readFile(svelteFile, 'utf-8');
      expect(processedContent).toContain('size-6');
      expect(processedContent).toContain('size-4');
    });
  });
});