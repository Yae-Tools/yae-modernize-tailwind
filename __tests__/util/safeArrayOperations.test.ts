import { describe, it, expect, beforeEach } from 'vitest';
import { SafeClassProcessor, ClassUtils } from '../../src/util/safeArrayOperations';

describe('SafeArrayOperations', () => {
  describe('SafeClassProcessor', () => {
    let processor: SafeClassProcessor;

    beforeEach(() => {
      processor = new SafeClassProcessor(['w-4', 'h-4', 'text-red-500', 'p-2']);
    });

    describe('markForRemoval', () => {
      it('should mark existing class for removal', () => {
        const result = processor.markForRemoval('w-4');
        expect(result).toBe(true);
        
        const executed = processor.execute();
        expect(executed.newClasses).not.toContain('w-4');
        expect(executed.changed).toBe(true);
      });

      it('should return false for non-existent class', () => {
        const result = processor.markForRemoval('non-existent');
        expect(result).toBe(false);
        
        const executed = processor.execute();
        expect(executed.changed).toBe(false);
      });

      it('should handle multiple removals without index shifting issues', () => {
        processor.markForRemoval('w-4');
        processor.markForRemoval('h-4');
        
        const executed = processor.execute();
        expect(executed.newClasses).not.toContain('w-4');
        expect(executed.newClasses).not.toContain('h-4');
        expect(executed.newClasses).toContain('text-red-500');
        expect(executed.newClasses).toContain('p-2');
      });
    });

    describe('markForReplacement', () => {
      it('should replace existing class', () => {
        const result = processor.markForReplacement('w-4', 'w-8');
        expect(result).toBe(true);
        
        const executed = processor.execute();
        expect(executed.newClasses).not.toContain('w-4');
        expect(executed.newClasses).toContain('w-8');
      });

      it('should return false for non-existent class', () => {
        const result = processor.markForReplacement('non-existent', 'replacement');
        expect(result).toBe(false);
      });
    });

    describe('addClass', () => {
      it('should add new classes', () => {
        processor.addClass('new-class');
        
        const executed = processor.execute();
        expect(executed.newClasses).toContain('new-class');
        expect(executed.changed).toBe(true);
      });

      it('should add multiple classes', () => {
        processor.addClasses(['class1', 'class2']);
        
        const executed = processor.execute();
        expect(executed.newClasses).toContain('class1');
        expect(executed.newClasses).toContain('class2');
      });
    });

    describe('execute', () => {
      it('should maintain class order', () => {
        processor.markForReplacement('h-4', 'h-8');
        
        const executed = processor.execute();
        const wIndex = executed.newClasses.indexOf('w-4');
        const hIndex = executed.newClasses.indexOf('h-8');
        
        expect(wIndex).toBeLessThan(hIndex);
      });

      it('should handle complex operations correctly', () => {
        processor.markForRemoval('w-4');
        processor.markForRemoval('h-4');
        processor.addClass('size-4');
        processor.markForReplacement('p-2', 'p-4');
        
        const executed = processor.execute();
        expect(executed.newClasses).toEqual(['text-red-500', 'p-4', 'size-4']);
        expect(executed.operations).toHaveLength(4);
      });

      it('should return unchanged result when no operations', () => {
        const executed = processor.execute();
        expect(executed.changed).toBe(false);
        expect(executed.newClasses).toEqual(['w-4', 'h-4', 'text-red-500', 'p-2']);
      });
    });

    describe('preview', () => {
      it('should show current state without executing', () => {
        processor.markForRemoval('w-4');
        processor.addClass('new-class');
        
        const preview = processor.preview();
        expect(preview.marks).toHaveLength(1);
        expect(preview.additions).toContain('new-class');
        expect(preview.original).toEqual(['w-4', 'h-4', 'text-red-500', 'p-2']);
      });
    });

    describe('reset', () => {
      it('should clear all marks and additions', () => {
        processor.markForRemoval('w-4');
        processor.addClass('new-class');
        processor.reset();
        
        const executed = processor.execute();
        expect(executed.changed).toBe(false);
        expect(executed.newClasses).toEqual(['w-4', 'h-4', 'text-red-500', 'p-2']);
      });
    });
  });

  describe('ClassUtils', () => {
    describe('replacePair', () => {
      it('should replace both classes when both exist', () => {
        const processor = new SafeClassProcessor(['w-4', 'h-4', 'text-red-500']);
        const result = ClassUtils.replacePair(processor, 'w-4', 'h-4', 'size-4');
        
        expect(result).toBe(true);
        const executed = processor.execute();
        expect(executed.newClasses).toContain('size-4');
        expect(executed.newClasses).not.toContain('w-4');
        expect(executed.newClasses).not.toContain('h-4');
      });

      it('should not replace when only one class exists', () => {
        const processor = new SafeClassProcessor(['w-4', 'text-red-500']);
        const result = ClassUtils.replacePair(processor, 'w-4', 'h-4', 'size-4');
        
        expect(result).toBe(false);
        const executed = processor.execute();
        expect(executed.changed).toBe(false);
      });

      it('should reset processor state when replacement fails', () => {
        const processor = new SafeClassProcessor(['w-4', 'text-red-500']);
        ClassUtils.replacePair(processor, 'w-4', 'h-4', 'size-4');
        
        const executed = processor.execute();
        expect(executed.newClasses).toContain('w-4');
      });
    });

    describe('extractValue', () => {
      it('should extract value from hyphenated class', () => {
        expect(ClassUtils.extractValue('w-4')).toBe('4');
        expect(ClassUtils.extractValue('text-red-500')).toBe('500');
        expect(ClassUtils.extractValue('space-x-2')).toBe('2');
      });

      it('should return null for classes without values', () => {
        expect(ClassUtils.extractValue('flex')).toBeNull();
        expect(ClassUtils.extractValue('w')).toBeNull();
      });

      it('should handle complex values', () => {
        expect(ClassUtils.extractValue('w-1/2')).toBe('1/2');
        expect(ClassUtils.extractValue('text-blue-500/75')).toBe('500/75');
      });
    });

    describe('extractPrefix', () => {
      it('should extract prefix from hyphenated class', () => {
        expect(ClassUtils.extractPrefix('w-4')).toBe('w');
        expect(ClassUtils.extractPrefix('text-red-500')).toBe('text');
        expect(ClassUtils.extractPrefix('space-x-2')).toBe('space');
      });

      it('should return whole class for non-hyphenated classes', () => {
        expect(ClassUtils.extractPrefix('flex')).toBe('flex');
        expect(ClassUtils.extractPrefix('grid')).toBe('grid');
      });
    });

    describe('haveSameValue', () => {
      it('should return true for classes with same values', () => {
        expect(ClassUtils.haveSameValue('w-4', 'h-4')).toBe(true);
        expect(ClassUtils.haveSameValue('mx-2', 'my-2')).toBe(true);
      });

      it('should return false for classes with different values', () => {
        expect(ClassUtils.haveSameValue('w-4', 'h-2')).toBe(false);
        expect(ClassUtils.haveSameValue('mx-2', 'my-4')).toBe(false);
      });

      it('should handle complex values', () => {
        expect(ClassUtils.haveSameValue('w-1/2', 'h-1/2')).toBe(true);
        expect(ClassUtils.haveSameValue('w-full', 'h-full')).toBe(true);
      });
    });

    describe('groupByVariant', () => {
      it('should group classes by variant', () => {
        const classInfos = [
          { variants: 'sm:', className: 'w-4', original: 'sm:w-4', index: 0 },
          { variants: 'sm:', className: 'h-4', original: 'sm:h-4', index: 1 },
          { variants: 'lg:', className: 'w-2', original: 'lg:w-2', index: 2 },
          { variants: '', className: 'text-red-500', original: 'text-red-500', index: 3 }
        ];
        
        const grouped = ClassUtils.groupByVariant(classInfos);
        
        expect(grouped['sm:']).toHaveLength(2);
        expect(grouped['lg:']).toHaveLength(1);
        expect(grouped['']).toHaveLength(1);
      });
    });

    describe('findClassesWithPrefix', () => {
      it('should find classes with specific prefix', () => {
        const classInfos = [
          { variants: '', className: 'w-4', original: 'w-4', index: 0 },
          { variants: '', className: 'h-4', original: 'h-4', index: 1 },
          { variants: '', className: 'text-red-500', original: 'text-red-500', index: 2 }
        ];
        
        const wClasses = ClassUtils.findClassesWithPrefix(classInfos, 'w');
        expect(wClasses).toHaveLength(1);
        expect(wClasses[0].className).toBe('w-4');
      });
    });

    describe('createProcessor', () => {
      it('should create processor from class string', () => {
        const processor = ClassUtils.createProcessor('w-4 h-4 text-red-500');
        expect(processor).toBeInstanceOf(SafeClassProcessor);
        
        const executed = processor.execute();
        expect(executed.newClasses).toEqual(['w-4', 'h-4', 'text-red-500']);
      });

      it('should handle empty strings', () => {
        const processor = ClassUtils.createProcessor('');
        const executed = processor.execute();
        expect(executed.newClasses).toEqual([]);
      });

      it('should filter out empty classes', () => {
        const processor = ClassUtils.createProcessor('w-4  h-4   text-red-500');
        const executed = processor.execute();
        expect(executed.newClasses).toEqual(['w-4', 'h-4', 'text-red-500']);
      });
    });

    describe('validateClassesExist', () => {
      it('should return true when all required classes exist', () => {
        const classes = ['w-4', 'h-4', 'text-red-500'];
        const required = ['w-4', 'h-4'];
        
        expect(ClassUtils.validateClassesExist(classes, required)).toBe(true);
      });

      it('should return false when some required classes are missing', () => {
        const classes = ['w-4', 'text-red-500'];
        const required = ['w-4', 'h-4'];
        
        expect(ClassUtils.validateClassesExist(classes, required)).toBe(false);
      });
    });

    describe('removeDuplicates', () => {
      it('should remove duplicate classes while preserving order', () => {
        const classes = ['w-4', 'h-4', 'w-4', 'text-red-500', 'h-4'];
        const result = ClassUtils.removeDuplicates(classes);
        
        expect(result).toEqual(['w-4', 'h-4', 'text-red-500']);
      });

      it('should handle empty arrays', () => {
        expect(ClassUtils.removeDuplicates([])).toEqual([]);
      });
    });

    describe('mergeClasses', () => {
      it('should merge two class arrays and remove duplicates', () => {
        const classes1 = ['w-4', 'h-4'];
        const classes2 = ['text-red-500', 'w-4'];
        
        const result = ClassUtils.mergeClasses(classes1, classes2);
        expect(result).toEqual(['w-4', 'h-4', 'text-red-500']);
      });
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle very large class lists efficiently', () => {
      const largeClassList = Array(1000).fill(0).map((_, i) => `class-${i}`);
      const processor = new SafeClassProcessor(largeClassList);
      
      // Mark every 10th class for removal
      for (let i = 0; i < 1000; i += 10) {
        processor.markForRemoval(`class-${i}`);
      }
      
      const startTime = Date.now();
      const result = processor.execute();
      const endTime = Date.now();
      
      expect(result.newClasses).toHaveLength(900);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should handle empty class lists', () => {
      const processor = new SafeClassProcessor([]);
      const result = processor.execute();
      
      expect(result.newClasses).toEqual([]);
      expect(result.changed).toBe(false);
    });

    it('should handle special characters in class names', () => {
      const processor = new SafeClassProcessor(['w-4', 'h-4', 'bg-blue-500/75', 'hover:scale-110']);
      processor.markForRemoval('bg-blue-500/75');
      
      const result = processor.execute();
      expect(result.newClasses).not.toContain('bg-blue-500/75');
      expect(result.newClasses).toContain('hover:scale-110');
    });

    it('should handle unicode class names', () => {
      const processor = new SafeClassProcessor(['w-4', 'h-4', '测试-类名', 'émoji-🎨']);
      processor.markForRemoval('测试-类名');
      
      const result = processor.execute();
      expect(result.newClasses).not.toContain('测试-类名');
      expect(result.newClasses).toContain('émoji-🎨');
    });
  });
});