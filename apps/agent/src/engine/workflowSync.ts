// Re-export from shared-contracts — 逻辑已提升到共享包
export {
  getDefaultDependencyGraph,
  computeAffectedFields,
  createSyncEvent,
  markStaleFields,
  initFieldVersions
} from '@orison/shared-contracts';
