import {
  guidedChangeChecklistSchema,
  guidedNovelProjectStateSchema,
  guidedNovelInterviewAnswerSchema,
  guidedNovelStartRequestSchema,
} from '@orison/shared-contracts';
import type { GuidedNovelProjectState } from '@orison/shared-contracts';
import { API_BASE } from '../constants';

export async function startGuidedNovelSession(projectPath: string): Promise<GuidedNovelProjectState> {
  const body = guidedNovelStartRequestSchema.parse({ projectPath });
  const res = await fetch(`${API_BASE}/v1/guided-novel/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`startGuidedNovelSession:${res.status}`);
  }
  return guidedNovelProjectStateSchema.parse(await res.json());
}

export async function restoreGuidedNovelSession(
  state: GuidedNovelProjectState,
): Promise<GuidedNovelProjectState> {
  const body = guidedNovelProjectStateSchema.parse(state);
  const res = await fetch(`${API_BASE}/v1/guided-novel/sessions/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`restoreGuidedNovelSession:${res.status}`);
  }
  return guidedNovelProjectStateSchema.parse(await res.json());
}

export async function submitGuidedNovelInterviewAnswer(
  sessionId: string,
  answer: string,
): Promise<GuidedNovelProjectState> {
  const body = guidedNovelInterviewAnswerSchema.parse({ answer });
  const res = await fetch(`${API_BASE}/v1/guided-novel/sessions/${encodeURIComponent(sessionId)}/interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`submitGuidedNovelInterviewAnswer:${res.status}`);
  }
  return guidedNovelProjectStateSchema.parse(await res.json());
}

export async function advanceGuidedNovelToNextChapter(
  sessionId: string,
): Promise<GuidedNovelProjectState> {
  const res = await fetch(`${API_BASE}/v1/guided-novel/sessions/${encodeURIComponent(sessionId)}/chapters/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`advanceGuidedNovelToNextChapter:${res.status}`);
  }
  return guidedNovelProjectStateSchema.parse(await res.json());
}

export async function approveGuidedNovelChapter(
  sessionId: string,
): Promise<GuidedNovelProjectState> {
  const res = await fetch(`${API_BASE}/v1/guided-novel/sessions/${encodeURIComponent(sessionId)}/chapter/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`approveGuidedNovelChapter:${res.status}`);
  }
  return guidedNovelProjectStateSchema.parse(await res.json());
}

export async function acceptGuidedNovelChangeReview(
  sessionId: string,
  checklist: unknown,
): Promise<GuidedNovelProjectState> {
  const body = guidedChangeChecklistSchema.parse(checklist);
  const res = await fetch(`${API_BASE}/v1/guided-novel/sessions/${encodeURIComponent(sessionId)}/change-review/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`acceptGuidedNovelChangeReview:${res.status}`);
  }
  return guidedNovelProjectStateSchema.parse(await res.json());
}
