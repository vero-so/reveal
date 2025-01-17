/*!
 * Copyright 2021 Cognite AS
 */

import 'jest-extended';

import { LevelOfDetail } from '../../packages/cad-parsers/src/cad//LevelOfDetail';
import { WantedSector } from '../../packages/cad-parsers/src/cad/types';

interface Matrix4 {
  elements: Float32Array;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export function expectVector3Equal(a: Vector3, b: Vector3): void {
  expect(a.x).toBeCloseTo(b.x);
  expect(a.y).toBeCloseTo(b.y);
  expect(a.z).toBeCloseTo(b.z);
}

export function expectMatrix4Equal(a: Matrix4, b: Matrix4): void {
  for (let i = 0; i < 16; i++) {
    expect(a.elements[i]).toBeCloseTo(b.elements[i]);
  }
}

export function expectVector3Valid(a: Vector3): void {
  expect(a.x).toBeDefined();
  expect(a.y).toBeDefined();
  expect(a.z).toBeDefined();
}

export function expectColorEqual(a: Color, b: Color): void {
  expect(a.r).toBeCloseTo(b.r);
  expect(a.g).toBeCloseTo(b.g);
  expect(a.b).toBeCloseTo(b.b);
}

export function expectColorValid(a: Color): void {
  expect(a.r).toBeDefined();
  expect(a.g).toBeDefined();
  expect(a.b).toBeDefined();
}

export function expectBoundingBoxEqual(a: BoundingBox, b: BoundingBox): void {
  expectVector3Equal(a.min, b.min);
  expectVector3Equal(a.max, b.max);
}

export function expectSetEqual<T>(actual: Set<T>, expected: T[]): void {
  expect([...actual]).toIncludeSameMembers(expected);
}

export function expectContainsSectorsWithLevelOfDetail(
  sectors: WantedSector[],
  expectedSimple: number[],
  expectedDetailed: number[]
): void {
  for (const id of expectedSimple) {
    expect(sectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: expect.objectContaining({ id }), levelOfDetail: LevelOfDetail.Simple })
      ])
    );
  }
  for (const id of expectedDetailed) {
    expect(sectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: expect.objectContaining({ id }), levelOfDetail: LevelOfDetail.Detailed })
      ])
    );
  }
}
