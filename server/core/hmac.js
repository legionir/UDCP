import { canonicalString, hmacHex } from './protocol.js';

export function verifyAuth(msg, secret, headerToken = null) {
  const auth = msg.auth;
  if (!auth) return { valid: false, reason: 'NO_AUTH' };
  
  const token = auth.token || headerToken;
  if (token !== process.env.AUTH_TOKEN) {
    return { valid: false, reason: 'INVALID_TOKEN' };
  }
  
  if (typeof auth.exp !== 'number' || auth.exp < Date.now()) {
    return { valid: false, reason: 'EXPIRED' };
  }
  
  // Replay check (key: id:nonce:transport)
  // Will be checked by replayCache in transport layer
  
  // Verify signature
  const canonical = canonicalString(msg);
  const expectedSig = hmacHex(secret, canonical);
  
  if (auth.sig !== expectedSig) {
    return { valid: false, reason: 'INVALID_SIG' };
  }
  
  return { valid: true };
}
