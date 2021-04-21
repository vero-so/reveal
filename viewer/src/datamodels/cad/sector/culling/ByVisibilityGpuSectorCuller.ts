/*!
 * Copyright 2021 Cognite AS
 */

// Note! We introduce ThreeJS as a dependency here, but it's not exposed.
// If we add other rendering engines, we should consider to implement this in 'pure'
// WebGL.
import * as THREE from 'three';

import {
  GpuOrderSectorsByVisibilityCoverage,
  OrderSectorsByVisibilityCoverage
} from './OrderSectorsByVisibilityCoverage';
import { SectorCuller } from './SectorCuller';
import { TakenSectorTree } from './TakenSectorTree';
import {
  PrioritizedWantedSector,
  DetermineSectorCostDelegate,
  DetermineSectorsInput,
  SectorCost,
  addSectorCost,
  SectorLoadingSpendage
} from './types';
import { LevelOfDetail } from '../LevelOfDetail';
import { CadModelMetadata } from '../../CadModelMetadata';
import { SectorMetadata, WantedSector } from '../types';
import { toThreeVector3 } from '../../../../utilities';
import { CadModelSectorBudget } from '../../CadModelSectorBudget';
import { OccludingGeometryProvider } from './OccludingGeometryProvider';

/**
 * Options for creating GpuBasedSectorCuller.
 */
export type ByVisibilityGpuSectorCullerOptions = {
  /**
   * Renderer used to determine what sector to load.
   */
  renderer: THREE.WebGLRenderer;

  /**
   * Optional callback for determining the cost of a sector. The default unit of the cost
   * function is bytes downloaded.
   */
  determineSectorCost?: DetermineSectorCostDelegate;

  /**
   * Use a custom coverage utility to determine how "visible" each sector is.
   */
  coverageUtil: OrderSectorsByVisibilityCoverage;

  /**
   * Logging function for debugging.
   */
  logCallback?: (message?: any, ...optionalParameters: any[]) => void;
};

function assert(condition: boolean, message: string = 'assertion hit') {
  console.assert(condition, message);
}

class TakenSectorMap {
  get totalCost(): SectorCost {
    const totalCost: SectorCost = { downloadSize: 0, drawCalls: 0 };
    this.maps.forEach(tree => {
      addSectorCost(totalCost, tree.totalCost);
    });
    return totalCost;
  }
  private readonly maps: Map<string, TakenSectorTree> = new Map();
  private readonly determineSectorCost: DetermineSectorCostDelegate;

  // TODO 2020-04-21 larsmoa: Unit test TakenSectorMap
  constructor(determineSectorCost: DetermineSectorCostDelegate) {
    this.determineSectorCost = determineSectorCost;
  }

  initializeScene(modelMetadata: CadModelMetadata) {
    this.maps.set(modelMetadata.blobUrl, new TakenSectorTree(modelMetadata.scene.root, this.determineSectorCost));
  }

  getWantedSectorCount(): number {
    let count = 0;
    this.maps.forEach(tree => {
      count += tree.determineWantedSectorCount();
    });
    return count;
  }

  markSectorDetailed(model: CadModelMetadata, sectorId: number, priority: number) {
    const tree = this.maps.get(model.blobUrl);
    assert(
      !!tree,
      `Could not find sector tree for ${model.blobUrl} (have trees ${Array.from(this.maps.keys()).join(', ')})`
    );
    tree!.markSectorDetailed(sectorId, priority);
  }

  isWithinBudget(budget: CadModelSectorBudget): boolean {
    return (
      this.totalCost.downloadSize < budget.geometryDownloadSizeBytes &&
      this.totalCost.drawCalls < budget.maximumNumberOfDrawCalls
    );
  }

  collectWantedSectors(): PrioritizedWantedSector[] {
    const allWanted = new Array<PrioritizedWantedSector>();

    // Collect sectors
    for (const entry of this.maps) {
      const model = entry[0];
      const tree = entry[1];
      allWanted.push(...tree.toWantedSectors(model));
    }

    // Sort by priority
    allWanted.sort((l, r) => r.priority - l.priority);
    return allWanted;
  }

  clear() {
    this.maps.clear();
  }
}

/**
 * SectorCuller that uses the GPU to determine an approximation
 * of how "visible" each sector is to get a priority for each sector
 * and loads sectors based on priority within a budget.
 */
export class ByVisibilityGpuSectorCuller implements SectorCuller {
  private readonly options: Required<ByVisibilityGpuSectorCullerOptions>;
  private readonly takenSectors: TakenSectorMap;

  constructor(options: ByVisibilityGpuSectorCullerOptions) {
    this.options = {
      renderer: options.renderer,
      determineSectorCost: options && options.determineSectorCost ? options.determineSectorCost : computeSectorCost,
      logCallback:
        options && options.logCallback
          ? options.logCallback
          : // No logging
            () => {},
      coverageUtil: options.coverageUtil
    };
    this.takenSectors = new TakenSectorMap(this.options.determineSectorCost);
  }

  dispose() {
    this.options.coverageUtil.dispose();
  }

  determineSectors(input: DetermineSectorsInput): { wantedSectors: WantedSector[]; spendage: SectorLoadingSpendage } {
    const takenSectors = this.update(
      input.camera,
      input.cadModelsMetadata,
      input.clippingPlanes,
      input.clipIntersection,
      input.budget
    );
    const wanted = takenSectors.collectWantedSectors();
    const nonDiscarded = wanted.filter(x => x.levelOfDetail !== LevelOfDetail.Discarded);

    const totalSectorCount = input.cadModelsMetadata.reduce((sum, x) => sum + x.scene.sectorCount, 0);
    const takenSectorCount = nonDiscarded.length;
    const takenSimpleCount = nonDiscarded.filter(x => x.levelOfDetail === LevelOfDetail.Simple).length;
    const forcedDetailedSectorCount = nonDiscarded.filter(x => !Number.isFinite(x.priority)).length;
    const accumulatedPriority = nonDiscarded
      .filter(x => Number.isFinite(x.priority) && x.priority > 0)
      .reduce((sum, x) => sum + x.priority, 0);
    const takenDetailedPercent = ((100.0 * (takenSectorCount - takenSimpleCount)) / totalSectorCount).toPrecision(3);
    const takenPercent = ((100.0 * takenSectorCount) / totalSectorCount).toPrecision(3);

    this.log(
      `Scene: ${takenSectorCount} (${forcedDetailedSectorCount} required, ${totalSectorCount} sectors, ${takenPercent}% of all sectors - ${takenDetailedPercent}% detailed)`
    );
    const spendage: SectorLoadingSpendage = {
      drawCalls: takenSectors.totalCost.drawCalls,
      downloadSize: takenSectors.totalCost.downloadSize,
      totalSectorCount,
      forcedDetailedSectorCount,
      loadedSectorCount: takenSectorCount,
      simpleSectorCount: takenSimpleCount,
      detailedSectorCount: takenSectorCount - takenSimpleCount,
      accumulatedPriority
    };
    return { spendage, wantedSectors: wanted };
  }

  filterSectorsToLoad(input: DetermineSectorsInput, wantedSectors: WantedSector[]): Promise<WantedSector[]> {
    const filtered = this.options.coverageUtil.cullOccludedSectors(input.camera, wantedSectors);
    return Promise.resolve(filtered);
  }

  private update(
    camera: THREE.PerspectiveCamera,
    models: CadModelMetadata[],
    clippingPlanes: THREE.Plane[] | null,
    clipIntersection: boolean,
    budget: CadModelSectorBudget
  ): TakenSectorMap {
    const { coverageUtil } = this.options;
    const takenSectors = this.takenSectors;
    takenSectors.clear();
    models.forEach(x => takenSectors.initializeScene(x));

    // Update wanted sectors
    coverageUtil.setModels(models);
    coverageUtil.setClipping(clippingPlanes, clipIntersection);
    const prioritized = coverageUtil.orderSectorsByVisibility(camera);

    // Add high details for all sectors the camera is inside or near
    this.addHighDetailsForNearSectors(camera, models, budget, takenSectors, clippingPlanes, clipIntersection);

    let debugAccumulatedPriority = 0.0;
    const prioritizedLength = prioritized.length;

    let i = 0;
    for (i = 0; i < prioritizedLength && takenSectors.isWithinBudget(budget); i++) {
      const x = prioritized[i];
      takenSectors.markSectorDetailed(x.model, x.sectorId, x.priority);
      debugAccumulatedPriority += x.priority;
    }

    this.log(`Retrieving ${i} of ${prioritizedLength} (last: ${prioritized.length > 0 ? prioritized[i - 1] : null})`);
    this.log(
      `Total scheduled: ${takenSectors.getWantedSectorCount()} of ${prioritizedLength} (cost: ${
        takenSectors.totalCost.downloadSize / 1024 / 1024
      }/${budget.geometryDownloadSizeBytes / 1024 / 1024}, drawCalls: ${takenSectors.totalCost.drawCalls}/${
        budget.maximumNumberOfDrawCalls
      }, priority: ${debugAccumulatedPriority})`
    );

    return takenSectors;
  }

  private addHighDetailsForNearSectors(
    camera: THREE.PerspectiveCamera,
    models: CadModelMetadata[],
    budget: CadModelSectorBudget,
    takenSectors: TakenSectorMap,
    clippingPlanes: THREE.Plane[] | null,
    clipIntersection: boolean
  ) {
    const shortRangeCamera = camera.clone(true) as THREE.PerspectiveCamera;
    shortRangeCamera.far = budget.highDetailProximityThreshold;
    shortRangeCamera.updateProjectionMatrix();
    const cameraMatrixWorldInverse = shortRangeCamera.matrixWorldInverse;
    const cameraProjectionMatrix = shortRangeCamera.projectionMatrix;

    const transformedCameraMatrixWorldInverse = new THREE.Matrix4();
    models.forEach(model => {
      // Apply model transformation to camera matrix
      transformedCameraMatrixWorldInverse.multiplyMatrices(cameraMatrixWorldInverse, model.modelMatrix);

      let intersectingSectors = model.scene.getSectorsIntersectingFrustum(
        cameraProjectionMatrix,
        transformedCameraMatrixWorldInverse
      );

      if (clippingPlanes != null && clippingPlanes.length > 0) {
        intersectingSectors = this.testForClippingOcclusion(
          intersectingSectors,
          clippingPlanes,
          model.modelMatrix,
          clipIntersection
        );
      }

      this.markSectorsAsDetailed(intersectingSectors, takenSectors, model);
    });
  }

  private testForClippingOcclusion(
    intersectingSectors: SectorMetadata[],
    clippingPlanes: THREE.Plane[],
    modelMatrix: THREE.Matrix4,
    clipIntersection: boolean
  ): SectorMetadata[] {
    const passingSectors = [];

    for (let i = 0; i < intersectingSectors.length; i++) {
      const boundPoints = intersectingSectors[i].bounds.getCornerPoints().map(p => {
        const outvec = new THREE.Vector3();

        toThreeVector3(outvec, p);
        outvec.applyMatrix4(modelMatrix);

        return outvec;
      });

      let shouldKeep = !clipIntersection;
      for (let k = 0; k < clippingPlanes.length; k++) {
        let planeAccepts = false;

        for (let j = 0; j < boundPoints.length; j++) {
          planeAccepts = clippingPlanes[k].distanceToPoint(boundPoints[j]) >= 0 || planeAccepts;
        }

        if (clipIntersection) {
          shouldKeep = shouldKeep || planeAccepts;
        } else {
          shouldKeep = shouldKeep && planeAccepts;
        }
      }

      if (shouldKeep) {
        passingSectors.push(intersectingSectors[i]);
      }
    }
    return passingSectors;
  }

  private markSectorsAsDetailed(
    intersectingSectors: SectorMetadata[],
    takenSectors: TakenSectorMap,
    model: CadModelMetadata
  ) {
    for (let i = 0; i < intersectingSectors.length; i++) {
      takenSectors.markSectorDetailed(model, intersectingSectors[i].id, Infinity);
    }
  }

  private log(message?: any, ...optionalParameters: any[]) {
    this.options.logCallback(message, ...optionalParameters);
  }
}

function computeSectorCost(metadata: SectorMetadata, lod: LevelOfDetail): SectorCost {
  switch (lod) {
    case LevelOfDetail.Detailed:
      return {
        downloadSize: metadata.indexFile.downloadSize,
        drawCalls: metadata.estimatedDrawCallCount
      };
    case LevelOfDetail.Simple:
      return { downloadSize: metadata.facesFile.downloadSize, drawCalls: 1 };
    default:
      throw new Error(`Can't compute cost for lod ${lod}`);
  }
}

export function createDefaultSectorCuller(
  renderer: THREE.WebGLRenderer,
  occludingGeometryProvider: OccludingGeometryProvider
): SectorCuller {
  const coverageUtil = new GpuOrderSectorsByVisibilityCoverage({ renderer, occludingGeometryProvider });
  return new ByVisibilityGpuSectorCuller({ renderer, coverageUtil });
}
