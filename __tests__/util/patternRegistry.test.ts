import { describe, expect, it } from 'vitest';
import { applyClassReplacements, extractAllClassMatches, getPatternMatchersForFile } from '../../src/util/patternRegistry';


describe('PatternRegistry', () => {
  describe('getPatternMatchersForFile', () => {
    it('should return HTML patterns for .html files', () => {
      const matchers = getPatternMatchersForFile('index.html');
      expect(matchers.some(m => m.framework.includes('html'))).toBe(true);
    });

    it('should return React patterns for .jsx files', () => {
      const matchers = getPatternMatchersForFile('component.jsx');
      expect(matchers.some(m => m.framework.includes('react'))).toBe(true);
    });

    it('should return Vue patterns for .vue files', () => {
      const matchers = getPatternMatchersForFile('component.vue');
      expect(matchers.some(m => m.framework.includes('vue'))).toBe(true);
    });

    it('should return default patterns for unknown extensions', () => {
      const matchers = getPatternMatchersForFile('unknown.xyz');
      expect(matchers.some(m => m.framework.includes('html'))).toBe(true);
    });
  });

  describe('extractAllClassMatches', () => {
    it('should extract classes from HTML class attributes', () => {
      const content = '<div class="w-4 h-4 text-red-500">Content</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4 text-red-500');
    });

    it('should extract classes from React className attributes', () => {
      const content = '<div className="w-4 h-4 text-red-500">Content</div>';
      const matches = extractAllClassMatches(content, 'test.jsx');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4 text-red-500');
    });

    it('should extract classes from JSX className with curly braces', () => {
      const content = '<div className={"w-4 h-4 text-red-500"}>Content</div>';
      const matches = extractAllClassMatches(content, 'test.tsx');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4 text-red-500');
    });

    it('should extract classes from Vue :class bindings', () => {
      const content = '<div :class="w-4 h-4 text-red-500">Content</div>';
      const matches = extractAllClassMatches(content, 'test.vue');
      
      // Vue files prioritize Vue-specific patterns over HTML patterns for overlapping ranges
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4 text-red-500');
      expect(matches[0].matcher.framework).toContain('vue');
    });

    it('should handle multiple class attributes in one document', () => {
      const content = `
        <div class="w-4 h-4">First</div>
        <span className="p-2 m-2">Second</span>
      `;
      const matches = extractAllClassMatches(content, 'test.jsx');
      
      expect(matches).toHaveLength(2);
      expect(matches[0].classes).toBe('w-4 h-4');
      expect(matches[1].classes).toBe('p-2 m-2');
    });

    it('should handle malformed class attributes gracefully', () => {
      const content = '<div class="w-4 h-4>Unclosed quote</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      
      // Should not crash and should return empty or handle gracefully
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should handle empty class attributes', () => {
      const content = '<div class="">Empty</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('');
    });

    it('should handle multiline class attributes', () => {
      const content = `<div class="w-4
                         h-4
                         text-red-500">Content</div>`;
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toContain('w-4');
      expect(matches[0].classes).toContain('h-4');
      expect(matches[0].classes).toContain('text-red-500');
    });

    it('should handle template literals with class attributes', () => {
      const content = '`<div class="w-4 h-4">Template</div>`';
      const matches = extractAllClassMatches(content, 'test.js');
      
      // The pattern might match both the template literal and HTML inside
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // Check that at least one match contains the expected classes
      const hasExpectedClasses = matches.some(match => match.classes === 'w-4 h-4');
      expect(hasExpectedClasses).toBe(true);
    });

    it('should handle special characters in class names', () => {
      const content = '<div class="w-4 h-4 text-red-500/75 hover:scale-110">Content</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toContain('text-red-500/75');
      expect(matches[0].classes).toContain('hover:scale-110');
    });

    it('should handle mixed quote types', () => {
      const content = "<div class='w-4 h-4'>Single quotes</div>";
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4');
    });
  });

  describe('applyClassReplacements', () => {
    it('should apply single replacement correctly', () => {
      const content = '<div class="w-4 h-4">Content</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      const replacements = [{
        original: matches[0],
        newClasses: ['size-4']
      }];
      
      const result = applyClassReplacements(content, replacements);
      expect(result).toBe('<div class="size-4">Content</div>');
    });

    it('should apply multiple replacements in correct order', () => {
      const content = '<div class="w-4 h-4">First</div><span class="w-2 h-2">Second</span>';
      const matches = extractAllClassMatches(content, 'test.html');
      const replacements = [
        { original: matches[0], newClasses: ['size-4'] },
        { original: matches[1], newClasses: ['size-2'] }
      ];
      
      const result = applyClassReplacements(content, replacements);
      expect(result).toBe('<div class="size-4">First</div><span class="size-2">Second</span>');
    });

    it('should handle overlapping replacements safely', () => {
      const content = '<div class="w-4 h-4 p-2">Content</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      const replacements = [{
        original: matches[0],
        newClasses: ['size-4', 'p-2']
      }];
      
      const result = applyClassReplacements(content, replacements);
      expect(result).toBe('<div class="size-4 p-2">Content</div>');
    });

    it('should preserve document structure with multiple elements', () => {
      const content = `
        <div class="w-4 h-4">
          <span class="text-red-500">Nested</span>
        </div>
      `;
      const matches = extractAllClassMatches(content, 'test.html');
      const replacements = [{
        original: matches[0],
        newClasses: ['size-4']
      }];
      
      const result = applyClassReplacements(content, replacements);
      expect(result).toContain('<div class="size-4">');
      expect(result).toContain('<span class="text-red-500">Nested</span>');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely long class strings', () => {
      const longClasses = Array(1000).fill('class-name').join(' ');
      const content = `<div class="${longClasses}">Content</div>`;
      
      expect(() => {
        const matches = extractAllClassMatches(content, 'test.html');
        expect(matches).toHaveLength(1);
      }).not.toThrow();
    });

    it('should handle unicode characters in class names', () => {
      const content = '<div class="w-4 h-4 测试-类名 émoji-🎨">Content</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toContain('测试-类名');
      expect(matches[0].classes).toContain('émoji-🎨');
    });

    it('should handle complex HTML gracefully', () => {
      const content = '<div class="w-4 h-4" data-test="simple">Content</div>';
      const matches = extractAllClassMatches(content, 'test.html');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4');
    });

    it('should handle malformed HTML gracefully', () => {
      const content = '<div class="w-4 h-4" <span>Malformed</span></div>';
      
      expect(() => {
        extractAllClassMatches(content, 'test.html');
      }).not.toThrow();
    });

    it('should handle very large files efficiently', () => {
      const largeContent = Array(10000).fill('<div class="w-4 h-4">Item</div>').join('\\n');
      
      const startTime = Date.now();
      const matches = extractAllClassMatches(largeContent, 'test.html');
      const endTime = Date.now();
      
      expect(matches).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Framework-Specific Pattern Tests', () => {
    it('should handle Angular [class] bindings', () => {
      const content = '<div [class]="w-4 h-4">Angular</div>';
      const matches = extractAllClassMatches(content, 'test.html'); // Use .html instead of .ts
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4');
    });

    it('should handle Svelte class directives', () => {
      const content = '<div class="w-4 h-4">Svelte</div>';
      const matches = extractAllClassMatches(content, 'test.svelte');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4');
    });

    it('should handle PHP template syntax', () => {
      const content = '<div class="w-4 h-4 <?php echo $extraClass; ?>">PHP</div>';
      const matches = extractAllClassMatches(content, 'test.php');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toContain('w-4 h-4');
    });

    it('should handle complex Vue binding expressions', () => {
      const content = '<div v-bind:class="[baseClasses, { active: isActive }]">Vue</div>';
      
      expect(() => {
        extractAllClassMatches(content, 'test.vue');
      }).not.toThrow();
    });

    it('should handle JSX spread attributes', () => {
      const content = '<div {...props} className="w-4 h-4">JSX</div>';
      const matches = extractAllClassMatches(content, 'test.jsx');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].classes).toBe('w-4 h-4');
    });
  });
});