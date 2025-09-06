import { describe, it, expect } from 'vitest';
import sizeConversion from '../../src/util/sizeConversion';

describe('sizeConversion', () => {
  it('should not change content without class attributes', () => {
    const content = '<div>Hello World</div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with irrelevant classes', () => {
    const content = '<div class="text-red-500 font-bold"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content if w and h values are different', () => {
    const content = '<div class="w-4 h-2"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should convert w- and h- to size- when values are the same', () => {
    const content = '<div class="w-4 h-4"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should handle classes with variants', () => {
    const content = '<div class="sm:w-4 sm:h-4 lg:w-2 lg:h-2"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toContain('sm:size-4');
    expect(newContent).toContain('lg:size-2');
    expect(changed).toBe(true);
  });

  it('should handle multiple class attributes', () => {
    const content = '<div class="w-4 h-4"></div><span class="w-2 h-2"></span>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="size-4"></div><span class="size-2"></span>');
    expect(changed).toBe(true);
  });

  it('should preserve other classes', () => {
    const content = '<div class="text-lg font-bold w-4 h-4"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="text-lg font-bold size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should not convert if only w- is present', () => {
    const content = '<div class="w-4"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not convert if only h- is present', () => {
    const content = '<div class="h-4"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should handle multiple sets of w and h classes correctly', () => {
    const content = '<div class="w-4 h-4 text-red-500 w-2 h-2"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toContain('size-4');
    expect(newContent).toContain('text-red-500');
    expect(newContent).toContain('size-2');
    expect(changed).toBe(true);
  });

  it('should convert non-numeric values (e.g., w-full)', () => {
    const content = '<div class="w-full h-full"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="size-full"></div>');
    expect(changed).toBe(true);
  });

  it('should handle className attribute in JSX files', () => {
    const content = '<div className="w-4 h-4"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.jsx');
    expect(newContent).toBe('<div className="size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should handle className attribute with curly braces', () => {
    const content = '<div className={"w-4 h-4"}></div>';
    const { newContent, changed } = sizeConversion(content, 'test.tsx');
    expect(newContent).toBe('<div className={"size-4"}></div>');
    expect(changed).toBe(true);
  });

  it('should handle mixed class and className attributes', () => {
    const content = '<div class="w-4 h-4"></div><span className="w-2 h-2"></span>';
    const { newContent, changed } = sizeConversion(content, 'test.jsx');
    expect(newContent).toBe('<div class="size-4"></div><span className="size-2"></span>');
    expect(changed).toBe(true);
  });

  // Enhanced tests for new features
  it('should handle Vue.js :class bindings', () => {
    const content = '<div :class="w-4 h-4">Vue component</div>';
    const { newContent, changed } = sizeConversion(content, 'test.vue');
    expect(newContent).toBe('<div :class="size-4">Vue component</div>');
    expect(changed).toBe(true);
  });

  it('should handle multiline class attributes', () => {
    const content = `<div class="w-4
                         h-4
                         text-red-500">Content</div>`;
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toContain('size-4');
    expect(newContent).toContain('text-red-500');
    expect(changed).toBe(true);
  });

  it('should handle template literals', () => {
    const content = '`<div class="w-4 h-4">Template</div>`';
    const { newContent, changed } = sizeConversion(content, 'test.js');
    expect(newContent).toBe('`<div class="size-4">Template</div>`');
    expect(changed).toBe(true);
  });

  it('should handle complex variant combinations', () => {
    const content = '<div class="hover:focus:sm:w-4 hover:focus:sm:h-4"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="hover:focus:sm:size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should handle fractional values', () => {
    const content = '<div class="w-1/2 h-1/2"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="size-1/2"></div>');
    expect(changed).toBe(true);
  });

  it('should handle arbitrary values', () => {
    const content = '<div class="w-[100px] h-[100px]"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="size-[100px]"></div>');
    expect(changed).toBe(true);
  });

  it('should preserve order of classes', () => {
    const content = '<div class="p-4 w-4 h-4 m-2"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="p-4 m-2 size-4"></div>');
    expect(changed).toBe(true);
  });

  it('should handle error cases gracefully', () => {
    // Malformed HTML should not crash
    const content = '<div class="w-4 h-4>Unclosed quote</div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(typeof newContent).toBe('string');
    expect(typeof changed).toBe('boolean');
  });

  it('should handle empty class attributes', () => {
    const content = '<div class="">Empty</div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should handle special characters in class names', () => {
    const content = '<div class="w-4 h-4 bg-blue-500/75"></div>';
    const { newContent, changed } = sizeConversion(content, 'test.html');
    expect(newContent).toBe('<div class="bg-blue-500/75 size-4"></div>');
    expect(changed).toBe(true);
  });
});