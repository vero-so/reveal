/*!
 * Copyright 2020 Cognite AS
 */

import * as THREE from 'three';

import { ModelDataClient } from '@cognite/reveal/utilities/networking/types';
import { SectorCuller } from '@cognite/reveal/internal';
import { createRevealManager } from '@cognite/reveal/public/createRevealManager';
import { RevealManager } from '@cognite/reveal/public/RevealManager';

describe('RevealManager', () => {
  const mockClient: ModelDataClient<{ id: number }> = {
    getApplicationIdentifier: () => {
      return 'dummy';
    }
  } as any;
  const sectorCuller: SectorCuller = {
    determineSectors: jest.fn(),
    dispose: jest.fn()
  };
  let manager: RevealManager<{ id: number }>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = createRevealManager('test', mockClient, { internal: { sectorCuller } });
  });

  test('resetRedraw() resets needsRedraw', () => {
    manager.requestRedraw();
    expect(manager.needsRedraw).toBeTrue();
    manager.resetRedraw();
    expect(manager.needsRedraw).toBeFalse();
  });

  test('set clippingPlanes triggers redraw', () => {
    expect(manager.needsRedraw).toBeFalse();
    const planes = [new THREE.Plane(), new THREE.Plane()];
    manager.clippingPlanes = planes;
    expect(manager.needsRedraw).toBeTrue();
  });

  test('set clipIntersection triggers redraw', () => {
    expect(manager.needsRedraw).toBeFalse();
    manager.clipIntersection = !manager.clipIntersection;
    expect(manager.needsRedraw).toBeTrue();
  });

  test('update only triggers update when camera changes', () => {
    manager.resetRedraw();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 100);
    manager.update(camera);
    expect(manager.needsRedraw).toBeTrue(); // Changed

    manager.resetRedraw();
    manager.update(camera);
    expect(manager.needsRedraw).toBeFalse(); // Unhanged

    manager.resetRedraw();
    camera.position.set(1, 2, 3);
    manager.update(camera);
    expect(manager.needsRedraw).toBeTrue(); // Changed again
  });

  test('dispose() disposes culler', () => {
    manager.dispose();
    expect(sectorCuller.dispose).toBeCalled();
  });
});
