import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parse } from 'dotenv';

export interface GscCredential {
  clientEmail: string;
  privateKey: string;
}

export interface OpsEnv {
  gscServiceAccount?: GscCredential;
  cfApiToken?: string;
  cfAccountId?: string;
}

export interface OpsEnvResolution extends OpsEnv {
  problems: string[];
}

interface RawServiceAccount {
  client_email?: string;
  private_key?: string;
}

function parseServiceAccount(raw: string, problems: string[]): GscCredential | undefined {
  let parsed: RawServiceAccount;
  try {
    parsed = JSON.parse(raw) as RawServiceAccount;
  } catch {
    problems.push(
      'GSC_SERVICE_ACCOUNT_JSON is not valid JSON. Re-download the key file from Google Cloud (IAM > Service Accounts > Keys) and set it again. Run `anvil-ops doctor` to re-check.',
    );
    return undefined;
  }
  if (!parsed.client_email || !parsed.private_key) {
    problems.push(
      'GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key. Use the key JSON downloaded from Google Cloud IAM, not another file. Run `anvil-ops doctor` to re-check.',
    );
    return undefined;
  }
  return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
}

export function loadOpsEnv(cwd: string): OpsEnvResolution {
  const problems: string[] = [];
  const result: OpsEnvResolution = { problems };

  let parsed: Record<string, string> = {};
  try {
    parsed = parse(readFileSync(join(cwd, '.env'), 'utf8'));
  } catch {
    return result; // no .env = everything disabled, not an error (doctor reports it)
  }

  const gscRaw = parsed['GSC_SERVICE_ACCOUNT_JSON']?.trim();
  if (gscRaw) {
    let raw: string | undefined;
    if (gscRaw.startsWith('{')) {
      raw = gscRaw;
    } else {
      const p = isAbsolute(gscRaw) ? gscRaw : join(cwd, gscRaw);
      if (!existsSync(p)) {
        problems.push(
          `GSC_SERVICE_ACCOUNT_JSON points to a missing file (${p}). Fix the path or paste the JSON inline. Run \`anvil-ops doctor\` to re-check.`,
        );
      } else {
        raw = readFileSync(p, 'utf8');
      }
    }
    if (raw !== undefined) {
      const sa = parseServiceAccount(raw, problems);
      if (sa) result.gscServiceAccount = sa;
    }
  }

  if (parsed['CF_API_TOKEN']) result.cfApiToken = parsed['CF_API_TOKEN'];
  if (parsed['CF_ACCOUNT_ID']) result.cfAccountId = parsed['CF_ACCOUNT_ID'];
  return result;
}
