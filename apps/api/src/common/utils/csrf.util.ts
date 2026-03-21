import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(24).toString('hex');
}
