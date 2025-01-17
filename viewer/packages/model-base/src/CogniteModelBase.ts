/*!
 * Copyright 2021 Cognite AS
 */

import { CameraConfiguration } from '@reveal/utilities';
import { SupportedModelTypes } from './SupportedModelTypes';

/**
 * Base class for 3D models supported by {@link Cognite3DViewer}.
 * @module @cognite/reveal
 */
export interface CogniteModelBase {
  readonly type: SupportedModelTypes;
  dispose(): void;
  getModelBoundingBox(outBbox?: THREE.Box3, restrictToMostGeometry?: boolean): THREE.Box3;
  getCameraConfiguration(): CameraConfiguration | undefined;
  setModelTransformation(matrix: THREE.Matrix4): void;
  getModelTransformation(out?: THREE.Matrix4): THREE.Matrix4;
}
