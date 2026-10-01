import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VRMExpression,
  VRMExpressionManager,
  VRMExpressionMorphTargetBind,
} from '@pixiv/three-vrm';
import { applyExtendedWeights } from '../src/preview/extended-weights.js';
test('extended morph weights survive updates without accumulating and combine independently', () => {
  const mesh = { morphTargetInfluences: [0] };
  const manager = new VRMExpressionManager();
  for (const name of ['JawOpen', 'MouthSmileLeft']) {
    const expression = new VRMExpression(name);
    expression.addBind(
      new VRMExpressionMorphTargetBind({ primitives: [mesh], index: 0, weight: 0.5 }),
    );
    manager.registerExpression(expression);
  }
  for (const weights of [
    [-1, 0],
    [2, 0],
    [2, -1],
    [0, 0],
    [1, 0],
  ]) {
    for (let frame = 0; frame < 3; frame++) {
      const values = weights.map((weight, i) => ({
        name: ['JawOpen', 'MouthSmileLeft'][i],
        weight,
      }));
      for (const { name, weight } of values) manager.setValue(name, weight);
      manager.update();
      applyExtendedWeights(manager, values);
      assert.equal(mesh.morphTargetInfluences[0], (weights[0] + weights[1]) * 0.5);
    }
  }
});
