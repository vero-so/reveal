/*!
 * Copyright 2021 Cognite AS
 */

import { IndexSet } from './IndexSet';
import { NumericRange } from './NumericRange';

describe('IndexSet', () => {
  test('contains all elements after adding range', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(11, 5));

    expect(set.count).toEqual(5);
    for (let i = 0; i < 11; i++) {
      expect(set.contains(i)).toBeFalse();
    }
    for (let i = 11; i < 16; ++i) {
      expect(set.contains(i)).toBeTrue();
    }
    expect(set.contains(16)).toBeFalse();
  });

  test('contains correct elements after adding then removing elements', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(1, 3));
    set.remove(2);
    expect(set.count).toEqual(2);
    expect(set.contains(1)).toBeTrue();
    expect(set.contains(2)).toBeFalse();
    expect(set.contains(3)).toBeTrue();
  });

  test('two overlapping set then removing some elements', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(3, 10));
    set.addRange(new NumericRange(2, 12));
    set.removeRange(new NumericRange(5, 2));
    expect(set.count).toEqual(10);

    expect(Array.from(set.values()).sort((a, b) => a - b)).toEqual([2, 3, 4, 7, 8, 9, 10, 11, 12, 13]);
  });

  test('random adds and removes, result set is correct', () => {
    const expected = new Set<number>();
    const set = new IndexSet();

    for (let i = 0; i < 10000; i++) {
      const v = Math.round(1000 * (Math.random() - 0.5));
      const value = Math.abs(v);
      if (v > 0) {
        set.add(value);
        expected.add(value);
      } else {
        set.remove(value);
        expected.delete(value);
      }
    }

    expect(set.toArray().sort()).toEqual(Array.from(expected).sort());
  });

  test('intersectsWith without overlap, result is empty', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(0, 10));
    set.intersectWith(new IndexSet());
    expect(Array.from(set.values())).toBeEmpty();
  });

  test('intersectsWith with partial overlap, result is overlap items', () => {
    const set = new IndexSet();
    set.add(1);
    set.add(3);
    set.add(5);
    set.add(7);
    const set2 = new IndexSet();
    set2.addRange(new NumericRange(5, 3));
    set.intersectWith(set2);
    expect(Array.from(set.values()).sort()).toEqual([5, 7]);
  });

  test('union with self, returns original', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(5, 3));
    set.unionWith(set);
    expect(Array.from(set.values()).sort()).toEqual([5, 6, 7]);
  });

  test('union partially overlapping', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(1, 3));
    const set2 = new IndexSet();
    set2.addRange(new NumericRange(2, 3));
    set.unionWith(set2);
    expect(Array.from(set.values()).sort()).toEqual([1, 2, 3, 4]);
  });

  test('clone() returns equal set', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(1, 5));

    const cloned = set.clone();

    expect(cloned).toEqual(set);
  });

  test('manipulate cloned set doesnt modify original', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(1, 5));

    const cloned = set.clone();
    cloned.add(11);

    expect(set.contains(11)).toBeFalse();
  });

  test('manipulate original set doesnt modify clone', () => {
    const set = new IndexSet();
    set.addRange(new NumericRange(1, 5));

    const cloned = set.clone();
    set.add(11);

    expect(cloned.contains(11)).toBeFalse();
  });

  test('hasIntersectionWith returns true if there is any overlap', () => {
    const set1 = new IndexSet();
    set1.addRange(new NumericRange(1, 5));
    const set2 = new IndexSet();
    set2.addRange(new NumericRange(3, 4));

    expect(set1.hasIntersectionWith(set2)).toBeTrue();
  });

  test('hasIntersectionWith returns false if there is no overlap', () => {
    const set1 = new IndexSet();
    set1.addRange(new NumericRange(1, 5));
    const set2 = new IndexSet();
    set2.addRange(new NumericRange(10, 4));

    expect(set1.hasIntersectionWith(set2)).toBeFalse();
  });

  test('differenceWith removes overlapping elements', () => {
    const set1 = new IndexSet();
    set1.addRange(new NumericRange(1, 5));
    const set2 = new IndexSet();
    set2.addRange(new NumericRange(3, 5));

    set1.differenceWith(set2);

    expect(Array.from(set1.values()).sort()).toEqual([1, 2]);
  });
});