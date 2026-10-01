// Run after VRM.update(): its next update clears the morph weights before reapplying them.
// Keep the normal expression manager path for 0..1 and add only the preview excess.
export function applyExtendedWeights(manager, values) {
  for (const { name, weight } of values) {
    if (!Number.isFinite(weight)) continue;
    const delta = weight - Math.max(0, Math.min(1, weight));
    if (!delta) continue;
    for (const bind of manager.getExpression(name)?.binds ?? []) {
      // Only morph binds: never extrapolate material or texture changes.
      if (Array.isArray(bind.primitives) && Number.isInteger(bind.index)) bind.applyWeight(delta);
    }
  }
}
