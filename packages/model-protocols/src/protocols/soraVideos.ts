import type {
  ResolvedModelProfile,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from '@orison/shared-contracts';
import { ProtocolNotImplementedError } from '../errors';
import type { ProtocolAdapter } from '../types';

/**
 * `apiFormat: 'sora-videos'` — placeholder.
 *
 * Schema, IPC plumbing, and registry slot are all wired so a real adapter can
 * drop in here without re-plumbing the call sites. Until that happens any
 * call surfaces a clear "not yet wired up" error to the renderer rather than
 * a silent no-op.
 */
async function generateVideo(
  _profile: ResolvedModelProfile,
  _request: VideoGenerationRequest,
): Promise<VideoGenerationResponse> {
  throw new ProtocolNotImplementedError(
    "sora-videos generation is not yet wired up. Pick another video apiFormat or wait for the Sora adapter to ship.",
  );
}

export const soraVideosProtocol: ProtocolAdapter = {
  apiFormat: 'sora-videos',
  generateVideo,
};
