import { describe, it, expect } from 'vitest';
import createAxisConversion from '../../src/util/axisConversion';

describe('createAxisConversion', () => {
  const marginConversion = createAxisConversion('m');
  const paddingConversion = createAxisConversion('p');

  it('should not change content without class attributes', () => {
    const content = '<div>Hello World</div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with irrelevant classes', () => {
    const content = '<div class="text-red-500 font-bold"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content if x and y values are different', () => {
    const content = '<div class="mx-4 my-2"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should convert mx- and my- to m- when values are the same', () => {
    const content = '<div class="mx-4 my-4"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe('<div class="m-4"></div>');
    expect(changed).toBe(true);
  });

  it('should convert px- and py- to p- when values are the same', () => {
    const content = '<div class="px-8 py-8"></div>';
    const { newContent, changed } = paddingConversion(content);
    expect(newContent).toBe('<div class="p-8"></div>');
    expect(changed).toBe(true);
  });

  it('should handle classes with variants', () => {
    const content = '<div class="sm:mx-4 sm:my-4 lg:px-2 lg:py-2"></div>';
    const { newContent, changed } = marginConversion(content);
    // Check for presence of classes, as order is not guaranteed
    expect(newContent).toContain('sm:m-4');
    expect(newContent).toContain('lg:px-2');
    expect(newContent).toContain('lg:py-2');
    expect(changed).toBe(true);
  });

  it('should handle multiple class attributes', () => {
    const content = '<div class="mx-4 my-4"></div><span class="px-2 py-2"></span>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe('<div class="m-4"></div><span class="px-2 py-2"></span>');
    expect(changed).toBe(true);
  });

  it('should preserve other classes', () => {
    const content = '<div class="text-lg font-bold mx-4 my-4"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe('<div class="text-lg font-bold m-4"></div>');
    expect(changed).toBe(true);
  });

  it('should not convert if only mx- is present', () => {
    const content = '<div class="mx-4"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not convert if only my- is present', () => {
    const content = '<div class="my-4"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should handle multiple sets of x and y classes', () => {
    const content = '<div class="mx-4 my-4 text-red-500 px-2 py-2"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toContain('m-4');
    expect(newContent).toContain('text-red-500');
    expect(newContent).toContain('px-2');
    expect(newContent).toContain('py-2');
    expect(changed).toBe(true);
  });

  it('should handle different variants for x and y classes', () => {
    const content = '<div class="sm:mx-4 md:my-4"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should convert classes with non-numeric values (e.g., mx-auto)', () => {
    const content = '<div class="mx-auto my-auto"></div>';
    const { newContent, changed } = marginConversion(content);
    expect(newContent).toBe('<div class="m-auto"></div>');
    expect(changed).toBe(true);
  });
});