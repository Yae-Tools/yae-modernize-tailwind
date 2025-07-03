import { describe, it, expect } from 'vitest';
import parseClassName from '../../src/util/parseClassName';

describe('parseClassName', () => {
  it('should correctly parse a class with no variants', () => {
    const result = parseClassName('text-red-500');
    expect(result).toEqual({
      variants: '',
      className: 'text-red-500',
      original: 'text-red-500',
    });
  });

  it('should correctly parse a class with one variant', () => {
    const result = parseClassName('hover:text-blue-500');
    expect(result).toEqual({
      variants: 'hover:',
      className: 'text-blue-500',
      original: 'hover:text-blue-500',
    });
  });

  it('should correctly parse a class with multiple variants', () => {
    const result = parseClassName('sm:hover:text-green-500');
    expect(result).toEqual({
      variants: 'sm:hover:',
      className: 'text-green-500',
      original: 'sm:hover:text-green-500',
    });
  });

  it('should handle an empty string', () => {
    const result = parseClassName('');
    expect(result).toEqual({
      variants: '',
      className: '',
      original: '',
    });
  });

  it('should handle a class that is only variants', () => {
    const result = parseClassName('sm:hover:');
    expect(result).toEqual({
      variants: 'sm:hover:',
      className: '',
      original: 'sm:hover:',
    });
  });
});
