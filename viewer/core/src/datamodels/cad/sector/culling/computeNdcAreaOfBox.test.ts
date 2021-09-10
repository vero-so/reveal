/*!
 * Copyright 2021 Cognite AS
 */

import * as THREE from 'three';
import { computeNdcAreaOfBox } from './computeNdcAreaOfBox';

describe('computeNdcAreaOfBox', () => {
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    // At <0,0,0>, looking down negative z
    camera = new THREE.PerspectiveCamera();
  });

  test('box is out side frustum, returns 0', () => {
    const box = new THREE.Box3(new THREE.Vector3(5, 5, 2), new THREE.Vector3(6, 6, 3));
    const area = computeNdcAreaOfBox(camera, box);
    expect(area).toBe(0.0);
  });

  test('box is fully encapsulating frustum', () => {
    camera.near = 0.1;
    camera.far = 1.0;
    const box = new THREE.Box3(new THREE.Vector3(-10, -10, 0), new THREE.Vector3(10, 10, 1));
    const area = computeNdcAreaOfBox(camera, box);
    expect(area).toBe(4.0);
  });

  test('box is fully inside frustum', () => {
    camera.near = 0.1;
    camera.far = 1.0;
    const box = new THREE.Box3(new THREE.Vector3(-0.25, -0.25, -2), new THREE.Vector3(0.25, 0.25, -1));
    const area = computeNdcAreaOfBox(camera, box);
    expect(area).toBeGreaterThan(0.0);
    expect(area).toBeLessThan(4.0);
  });

  test('box intersecting frustum', () => {
    const camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 0, 1);
    const box = new THREE.Box3(new THREE.Vector3(0.0, 0.0, 0.0), new THREE.Vector3(1.5, 1.5, 1.5));
    const area = computeNdcAreaOfBox(camera, box);
    expect(area).toBe(1.0);
  });
});
