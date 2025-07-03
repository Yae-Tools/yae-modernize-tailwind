import { describe, it, expect } from 'vitest';
import colorOpacityConversion from '../../src/util/colorOpacityConversion';

describe('colorOpacityConversion', () => {
  it('should not change content without class attributes', () => {
    const content = '<div>Hello World</div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with irrelevant classes', () => {
    const content = '<div class="text-red-500 font-bold"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with color classes but no opacity classes', () => {
    const content = '<div class="bg-red-500 text-blue-400"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should not change content with opacity classes but no color classes', () => {
    const content = '<div class="bg-opacity-50 text-opacity-75"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should convert bg-color and bg-opacity to bg-color/opacity', () => {
    const content = '<div class="bg-red-500 bg-opacity-50"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<div class="bg-red-500/50"></div>');
    expect(changed).toBe(true);
  });

  it('should convert text-color and text-opacity to text-color/opacity', () => {
    const content = '<span class="text-blue-400 text-opacity-75"></span>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<span class="text-blue-400/75"></span>');
    expect(changed).toBe(true);
  });

  it('should convert border-color and border-opacity to border-color/opacity', () => {
    const content = '<div class="border-green-300 border-opacity-25"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<div class="border-green-300/25"></div>');
    expect(changed).toBe(true);
  });

  it('should convert ring-color and ring-opacity to ring-color/opacity', () => {
    const content = '<div class="ring-purple-600 ring-opacity-100"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<div class="ring-purple-600/100"></div>');
    expect(changed).toBe(true);
  });

  it('should convert divide-color and divide-opacity to divide-color/opacity', () => {
    const content = '<div class="divide-gray-700 divide-opacity-50"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<div class="divide-gray-700/50"></div>');
    expect(changed).toBe(true);
  });

  it('should convert placeholder-color and placeholder-opacity to placeholder-color/opacity', () => {
    const content = '<input class="placeholder-red-500 placeholder-opacity-75" />';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<input class="placeholder-red-500/75" />');
    expect(changed).toBe(true);
  });

  it('should handle classes with variants', () => {
    const content = '<div class="hover:bg-red-500 hover:bg-opacity-50 focus:text-blue-400 focus:text-opacity-75"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toContain('hover:bg-red-500/50');
    expect(newContent).toContain('focus:text-blue-400/75');
    expect(changed).toBe(true);
  });

  it('should handle multiple class attributes', () => {
    const content = '<div class="bg-red-500 bg-opacity-50"></div><span class="text-blue-400 text-opacity-75"></span>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe('<div class="bg-red-500/50"></div><span class="text-blue-400/75"></span>');
    expect(changed).toBe(true);
  });

  it('should preserve other classes', () => {
    const content = '<div class="font-bold bg-red-500 bg-opacity-50 text-lg"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toContain('font-bold');
    expect(newContent).toContain('bg-red-500/50');
    expect(newContent).toContain('text-lg');
    expect(changed).toBe(true);
  });

  it('should not convert if opacity value is missing', () => {
    const content = '<div class="bg-red-500 bg-opacity-"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });

  it('should handle multiple color/opacity pairs in one class attribute', () => {
    const content = '<div class="bg-red-500 bg-opacity-50 text-blue-400 text-opacity-75"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toContain('bg-red-500/50');
    expect(newContent).toContain('text-blue-400/75');
    expect(changed).toBe(true);
  });

  it('should not convert if color class is already in new format', () => {
    const content = '<div class="bg-red-500/50 bg-opacity-75"></div>';
    const { newContent, changed } = colorOpacityConversion(content);
    expect(newContent).toBe(content);
    expect(changed).toBe(false);
  });
});
