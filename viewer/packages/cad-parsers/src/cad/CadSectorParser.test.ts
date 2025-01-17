/*!
 * Copyright 2021 Cognite AS
 */

import { of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { CadSectorParser } from './CadSectorParser';
import { WorkerPool } from '@reveal/utilities';
import { SectorQuads } from '@cognite/reveal-parser-worker';

jest.mock('../../../utilities/src/workers/WorkerPool');

describe('CadSectorParser', () => {
  const workerPool: WorkerPool = new WorkerPool();
  const parser = new CadSectorParser(workerPool);

  jest.useFakeTimers();

  test('parse i3d format', done => {
    // Arrange
    let events = 0;
    let errors = 0;
    // Act
    const observable = of({ format: 'i3d', data: new Uint8Array() }).pipe(mergeMap(x => parser.parseI3D(x.data)));

    // Assert
    observable.subscribe(
      _next => {
        events += 1;
      },
      _error => {
        errors += 1;
      },
      () => {
        expect(events).toBe(1);
        expect(errors).toBe(0);
        done();
      }
    );
    jest.advanceTimersByTime(1000);
  });

  // TODO: j-bjorne 17-04-2020: No idea why this fails. Will look into it later.
  test('parse f3d format', async () => {
    // Arrange
    let events = 0;
    let errors = 0;
    const result: SectorQuads = {
      treeIndexToNodeIdMap: new Map(),
      nodeIdToTreeIndexMap: new Map(),
      buffer: new Float32Array()
    };
    jest.spyOn(workerPool, 'postWorkToAvailable').mockImplementation(() => {
      return Promise.resolve(result);
    });

    // Act
    const observable = of({ format: 'f3d', data: new Uint8Array() }).pipe(mergeMap(x => parser.parseF3D(x.data)));

    // Assert
    observable.subscribe(
      _next => {
        events += 1;
      },
      _error => {
        errors += 1;
      },
      () => {
        expect(events).toBe(1);
        expect(errors).toBe(0);
        // done();
      }
    );
    await observable.toPromise();
    jest.advanceTimersByTime(1000);
    jest.runAllTimers();
  });
});
