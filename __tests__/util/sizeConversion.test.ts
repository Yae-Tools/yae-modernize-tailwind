import { describe, it, expect } from 'vitest';
import sizeConversion from '../../src/util/sizeConversion';

describe('sizeConversion', () => {
  it('should not change content without class attributes', () => {
    const content = '<div>Hello World</div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with irrelevant classes', () => {
    const content = '<div class="text-red-500 font-bold"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content if w and h values are different', () => {
    const content = '<div class="w-4 h-2"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should convert w- and h- to size- when values are the same', () => {
    const content = '<div class="w-4 h-4"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div class="size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should handle classes with variants', () => {
    const content = '<div class="sm:w-4 sm:h-4 lg:w-2 lg:h-2"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toContain('sm:size-4');
    expect(newContent).toContain('lg:size-2');
    expect(changed).toBe(true);
  });

  it('should handle multiple class attributes', () => {
    const content = '<div class="w-4 h-4"></div><span class="w-2 h-2"></span>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div class="size-4"></div><span class="size-2"></span>');
    expect(changed).toBe(true);
  });

  it('should preserve other classes', () => {
    const content = '<div class="text-lg font-bold w-4 h-4"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div class="text-lg font-bold size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should not convert if only w- is present', () => {
    const content = '<div class="w-4"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not convert if only h- is present', () => {
    const content = '<div class="h-4"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should handle multiple sets of w and h classes', () => {
    const content = '<div class="w-4 h-4 text-red-500 w-2 h-2"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toContain('size-4');
    expect(newContent).toContain('text-red-500');
    expect(newContent).toContain('w-2'); // Should not be converted
    expect(newContent).toContain('h-2'); // Should not be converted
    expect(changed).toBe(true);
  });

  it('should convert non-numeric values (e.g., w-full)', () => {
    const content = '<div class="w-full h-full"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div class="size-full"></div>');
    expect(changed).toBe(true);
  });

  it('should handle className attribute', () => {
    const content = '<div className="w-4 h-4"></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div className="size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should handle className attribute with curly braces', () => {
    const content = '<div className={"w-4 h-4"}></div>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div className={"size-4"}></div>');
    expect(changed).toBe(true);
  });

  it('should handle mixed class and className attributes', () => {
    const content = '<div class="w-4 h-4"></div><span className="w-2 h-2"></span>';
    const { newContent, changed } = sizeConversion(content);
    expect(newContent).toBe('<div class="size-4"></div><span className="size-2"></span>');
    expect(changed).toBe(true);
  });
});