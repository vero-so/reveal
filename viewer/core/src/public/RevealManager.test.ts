/*!
 * Copyright 2021 Cognite AS
 */
import * as THREE from 'three';

import { createRevealManager } from './createRevealManager';
import { RevealManager } from './RevealManager';
import { LoadingStateChangeListener } from '..';
import { createGlContext } from '../../../test-utilities';

import { ModelDataClient, ModelMetadataProvider } from '@reveal/modeldata-api';
import { SectorCuller } from '@reveal/cad-geometry-loaders';

describe('RevealManager', () => {
  const stubMetadataProvider: ModelMetadataProvider<{ id: number }> = {} as any;
  const stubClient: ModelDataClient = {
    getApplicationIdentifier: () => {
      return 'dummy';
    }
  } as any;
  const sectorCuller: SectorCuller = {
    determineSectors: jest.fn(),
    filterSectorsToLoad: jest.fn(),
    dispose: jest.fn()
  };
  let manager: RevealManager<{ id: number }>;
  let renderer: THREE.WebGLRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = createRevealManager('test', stubMetadataProvider, stubClient, renderer, new THREE.Scene(), {
      internal: { sectorCuller }
    });
  });

  beforeAll(() => {
    const context = createGlContext(64, 64, { preserveDrawingBuffer: true });
    renderer = new THREE.WebGLRenderer({ context });
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
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

  test('loadingStateChanged is not triggered if loading state doesnt change', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 100);
    const loadingStateChangedCb: LoadingStateChangeListener = jest.fn();
    manager.on('loadingStateChanged', loadingStateChangedCb);

    manager.update(camera);
    jest.advanceTimersByTime(10000);

    expect(loadingStateChangedCb).toBeCalledTimes(1);
  });

  test('addUiObject() and removeUiObject() requests redraw', () => {
    manager = createRevealManager('test', stubMetadataProvider, stubClient, renderer, new THREE.Scene(), {
      internal: { sectorCuller }
    });
    expect(manager).not.toBeUndefined();
    expect(manager.needsRedraw).toBeFalse();
    const uiObject = new THREE.Object3D();
    manager.addUiObject(uiObject, new THREE.Vector2(0, 0), new THREE.Vector2(100, 100));
    expect(manager.needsRedraw).toBeTrue();
    manager.resetRedraw();
    manager.removeUiObject(uiObject);
    expect(manager.needsRedraw).toBeTrue();
  });
});
