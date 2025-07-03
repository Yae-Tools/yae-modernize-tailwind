import { promises as fs } from 'fs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { detectEnvironment } from '../src/environment';

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

describe('detectEnvironment', () => {
  const mockAccess = vi.mocked(fs.access);
  const mockReadFile = vi.mocked(fs.readFile);
  const mockReaddir = vi.mocked(fs.readdir);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks to ensure no next.js config files exist unless explicitly tested
    mockAccess.mockImplementation((filePath) => {
      const pathStr = filePath.toString();
      if (pathStr.includes('next.config.js') || pathStr.includes('next.config.mjs')) {
        return Promise.reject();
      }
      return Promise.resolve();
    });
    // Default mock for package.json to be empty unless specified
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: {}, devDependencies: {} }));
    // Default mock for readdir to be empty unless specified
    mockReaddir.mockResolvedValue([] as any);
  });

  it('should detect Next.js environment', async () => {
    mockAccess.mockImplementation((filePath) => {
      const pathStr = filePath.toString();
      if (pathStr.includes('next.config.js')) {
        return Promise.resolve();
      }
      return Promise.reject();
    });
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Next.js');
  });

  it('should detect React environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { react: '^18.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('React');
  });

  it('should detect Angular environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { '@angular/core': '^15.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Angular');
  });

  it('should detect Svelte environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { svelte: '^4.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Svelte');
  });

  it('should detect Vue environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      dependencies: { vue: '^3.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Vue');
  });

  it('should detect HTML/CSS environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({})); // No package.json dependencies
    mockReaddir.mockResolvedValueOnce(['index.html', 'style.css'] as any);
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('HTML/CSS');
  });

  it('should detect Unknown environment', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({})); // No package.json dependencies
    mockReaddir.mockResolvedValueOnce([] as any); // No HTML/CSS files
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Unknown');
  });

  it('should handle package.json with devDependencies', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      devDependencies: { react: '^18.0.0' },
    }));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('React');
  });

  it('should handle empty package.json', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({}));
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Unknown');
  });

  it('should handle invalid package.json', async () => {
    mockReadFile.mockResolvedValueOnce('invalid json');
    const env = await detectEnvironment('/test/project');
    expect(env).toBe('Unknown');
  });
});