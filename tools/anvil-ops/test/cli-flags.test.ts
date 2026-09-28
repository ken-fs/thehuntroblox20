import { describe, expect, it } from 'vitest';
import { mergeSiteFlags, assertNotBothSiteAndAll, validateSiteName } from '../src/cli/flags.js';
import { OpsError } from '../src/core/errors.js';

describe('mergeSiteFlags (global ↔ subcommand flag merge)', () => {
  it('command-level flags win over global flags', () => {
    expect(mergeSiteFlags({ site: 'global-site' }, { site: 'cmd-site' })).toEqual({ site: 'cmd-site', all: false });
  });

  it('global flag fills in when the subcommand did not set it', () => {
    expect(mergeSiteFlags({ site: 'global-site' }, {})).toEqual({ site: 'global-site', all: false });
  });

  it('all defaults to false and a command all=true overrides a global unset', () => {
    expect(mergeSiteFlags({}, {})).toEqual({ site: undefined, all: false });
    expect(mergeSiteFlags({}, { all: true })).toEqual({ site: undefined, all: true });
    expect(mergeSiteFlags({ all: true }, {})).toEqual({ site: undefined, all: true });
  });

  it('explicit command-level site wins even when global --all was passed (command is more specific)', () => {
    expect(mergeSiteFlags({ all: true }, { site: 'cmd-site' })).toEqual({ site: 'cmd-site', all: true });
  });
});

describe('assertNotBothSiteAndAll (mutual exclusion, both flag positions)', () => {
  it('throws OpsError when both --site and --all end up set', () => {
    expect(() => assertNotBothSiteAndAll({ site: 'a', all: true })).toThrowError(OpsError);
    expect(() => assertNotBothSiteAndAll({ site: 'a', all: true })).toThrowError(/mutually exclusive/);
  });

  it('passes for either flag alone and for neither', () => {
    expect(() => assertNotBothSiteAndAll({ site: 'a' })).not.toThrow();
    expect(() => assertNotBothSiteAndAll({ all: true })).not.toThrow();
    expect(() => assertNotBothSiteAndAll({})).not.toThrow();
  });
});

describe('validateSiteName (sites add input gate)', () => {
  it('accepts slug-style names', () => {
    expect(validateSiteName('main-wiki')).toBe('main-wiki');
    expect(validateSiteName('site2')).toBe('site2');
    expect(validateSiteName('  padded  ')).toBe('padded');
    expect(validateSiteName('a.b_c-d')).toBe('a.b_c-d');
  });

  it('rejects empty names', () => {
    expect(() => validateSiteName('')).toThrowError(OpsError);
    expect(() => validateSiteName('   ')).toThrowError(OpsError);
  });

  it('rejects whitespace, control characters and names that would break the list table / --site ergonomics', () => {
    expect(() => validateSiteName('my site')).toThrowError(OpsError);
    expect(() => validateSiteName('my\nsite')).toThrowError(OpsError);
    expect(() => validateSiteName('-leading-dash')).toThrowError(OpsError);
    expect(() => validateSiteName('.dot-first')).toThrowError(OpsError);
    expect(() => validateSiteName('斜杠/name')).toThrowError(OpsError);
  });
});
