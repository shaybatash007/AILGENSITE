// AILGEN Lab: is the passcode right, and is the binding there? POST + header x-lab-key → { ok: true }
import { json } from '../../../_shared/ai.js';
import { gate } from './run.js';

export async function onRequestPost({ request, env }) {
  const denied = await gate(request, env);
  return denied || json({ ok: true, at: new Date().toISOString() });
}
