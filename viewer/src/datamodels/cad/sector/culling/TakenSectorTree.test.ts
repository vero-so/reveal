/*!
 * Copyright 2021 Cognite AS
 */

import { expectContainsSectorsWithLevelOfDetail } from '../../../../__testutilities__/expects';
import { generateSectorTree } from '../../../../__testutilities__/createSectorMetadata';
import { DetermineSectorCostDelegate, PrioritizedWantedSector } from './types';
import { TakenSectorTree } from './TakenSectorTree';
import { LevelOfDetail, traverseDepthFirst } from '../../../../internal';
import { SectorMetadata, CadModelMetadata } from '../../../../experimental';
import { Mutable } from '../../../../utilities/reflection';
import { SectorMetadataFacesFileSection } from '../types';

describe('TakenSectorTree', () => {
  const model: CadModelMetadata = {} as any;
  const determineSectorCost: DetermineSectorCostDelegate = () => ({ downloadSize: 1, drawCalls: 1 }); // Flat cost

  test('default tree contains root as simple', () => {
    const root = generateSectorTree(2);
    const tree = new TakenSectorTree(root, determineSectorCost);
    const wanted = tree.toWantedSectors(model.blobUrl);
    expectContainsSectorsWithLevelOfDetail(wanted, [0], []);
  });

  test('three levels, partial detailed at level 2', () => {
    // Arrange
    const root = generateSectorTree(3, 2);
    const tree = new TakenSectorTree(root, determineSectorCost);

    // Act
    tree.markSectorDetailed(0, 1);
    tree.markSectorDetailed(findId(root, '0/0/'), 1);

    // Assert
    const expectedDetailed = ['0/', '0/0/'];
    const expectedSimple = ['0/1/', '0/0/0/', '0/0/1/'];
    const wanted = tree.toWantedSectors(model.blobUrl);
    expectHasSectors(wanted, LevelOfDetail.Detailed, expectedDetailed);
    expectHasSectors(wanted, LevelOfDetail.Simple, expectedSimple);
  });

  test('add detailed sectors out of order', () => {
    // Arrange
    const root = generateSectorTree(5, 2);
    const tree = new TakenSectorTree(root, determineSectorCost);

    // Act
    tree.markSectorDetailed(findId(root, '0/0/0/'), 1);
    tree.markSectorDetailed(findId(root, '0/1/0/'), 1);

    // Assert
    const expectedDetailed = ['0/', '0/0/', '0/0/0/', '0/1/', '0/1/0/'];
    const expectedSimple = ['0/0/0/0/', '0/0/0/1/', '0/1/0/0/', '0/1/0/1/', '0/1/1/'];
    const wanted = tree.toWantedSectors(model.blobUrl);
    expectHasSectors(wanted, LevelOfDetail.Detailed, expectedDetailed);
    expectHasSectors(wanted, LevelOfDetail.Simple, expectedSimple);
  });

  test('Simple data is not added when sector has no f3d file', () => {
    // Arrange
    const root = generateSectorTree(3, 2);
    const mutableFacesFile: Mutable<SectorMetadataFacesFileSection> = root.children[0].facesFile;
    mutableFacesFile.fileName = null;
    const tree = new TakenSectorTree(root, determineSectorCost);

    // Act
    tree.markSectorDetailed(0, 1);

    // Assert
    const wanted = tree.toWantedSectors(model.blobUrl);
    expectHasSectors(wanted, LevelOfDetail.Detailed, ['0/']);
    expectHasSectors(wanted, LevelOfDetail.Simple, ['0/1/']);
  });

  test('construct with model without F3D for root', () => {
    // Arrange
    const root = generateSectorTree(3, 2);
    const mutableFacesFile: Mutable<SectorMetadataFacesFileSection> = root.facesFile;
    mutableFacesFile.fileName = null;

    // Act
    const tree = new TakenSectorTree(root, determineSectorCost);

    // Assert
    const wanted = tree.toWantedSectors(model.blobUrl);
    expect(wanted.find(x => x.metadata.path === '0/')?.levelOfDetail).toBe(LevelOfDetail.Discarded);
  });
});

function findId(root: SectorMetadata, path: string): number {
  let id = -1;
  traverseDepthFirst(root, x => {
    if (x.path === path) {
      id = x.id;
    }
    return id === -1;
  });
  return id;
}

function expectHasSectors(sectors: PrioritizedWantedSector[], lod: LevelOfDetail, expectedPaths: string[]) {
  const ids = sectors
    .filter(x => x.levelOfDetail === lod)
    .map(x => {
      return x.metadata.path;
    })
    .sort();
  expectedPaths.sort();
  ids.sort();
  expect(ids).toEqual(expectedPaths);
}