import { describe, it, expect } from 'vitest';
import gapConversion from '../../src/util/gapConversion';

describe('gapConversion', () => {
  it('should not change content without class attributes', () => {
    const content = '<div>Hello World</div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with irrelevant classes', () => {
    const content = '<div class="text-red-500 font-bold"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content if no flex or grid class is present', () => {
    const content = '<div class="space-x-4 space-y-4"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content if space-x and space-y values are different', () => {
    const content = '<div class="flex space-x-4 space-y-2"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should convert space-x- and space-y- to gap- when values are the same and flex is present', () => {
    const content = '<div class="flex space-x-4 space-y-4"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe('<div class="flex gap-4"></div>');
    expect(changed).toBe(true);
  });

  it('should convert space-x- and space-y- to gap- when values are the same and grid is present', () => {
    const content = '<div class="grid space-x-8 space-y-8"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe('<div class="grid gap-8"></div>');
    expect(changed).toBe(true);
  });

  it('should handle classes with variants', () => {
    const content = '<div class="sm:flex sm:space-x-4 sm:space-y-4 lg:grid lg:space-x-2 lg:space-y-2"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toContain('sm:flex');
    expect(newContent).toContain('sm:gap-4');
    expect(newContent).toContain('lg:grid');
    expect(newContent).toContain('lg:gap-2');
    expect(changed).toBe(true);
  });

  it('should handle multiple class attributes', () => {
    const content = '<div class="flex space-x-4 space-y-4"></div><span class="grid space-x-2 space-y-2"></span>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe('<div class="flex gap-4"></div><span class="grid gap-2"></span>');
    expect(changed).toBe(true);
  });

  it('should preserve other classes', () => {
    const content = '<div class="flex text-lg font-bold space-x-4 space-y-4"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe('<div class="flex text-lg font-bold gap-4"></div>');
    expect(changed).toBe(true);
  });

  it('should not convert if only space-x is present', () => {
    const content = '<div class="flex space-x-4"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not convert if only space-y is present', () => {
    const content = '<div class="flex space-y-4"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should handle multiple sets of space-x and space-y classes', () => {
    const content = '<div class="flex space-x-4 space-y-4 text-red-500 grid space-x-2 space-y-2"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toContain('flex');
    expect(newContent).toContain('gap-4');
    expect(newContent).toContain('text-red-500');
    expect(newContent).toContain('grid');
    expect(newContent).toContain('space-x-2'); // Should not be converted
    expect(newContent).toContain('space-y-2'); // Should not be converted
    expect(changed).toBe(true);
  });

  it('should convert non-numeric values (e.g., space-x-reverse)', () => {
    const content = '<div class="flex space-x-reverse space-y-reverse"></div>';
    const { newContent, changed } = gapConversion(content);
    expect(newContent).toBe('<div class="flex gap-reverse"></div>');
    expect(changed).toBe(true);
  });
});