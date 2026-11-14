import { describe, expect, it } from 'vitest';
import { mapDdinterRow, mapMedmapRow } from '../../src/services/dataset-import.js';
import { parseCsv, parseCsvWithHeader } from '../../src/utils/csv.js';

describe('parseCsv', () => {
  it('parses plain rows with LF and CRLF endings', () => {
    expect([...parseCsv('a,b\n1,2\r\n3,4')]).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles quotes, escaped quotes, commas and newlines inside quotes', () => {
    expect([...parseCsv('"x, y","say ""hi""","line\nbreak"\n')]).toEqual([
      ['x, y', 'say "hi"', 'line\nbreak'],
    ]);
  });

  it('keeps empty fields and skips blank lines', () => {
    expect([...parseCsv('a,,c\n\n,,\n')]).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('returns nothing for empty input', () => {
    expect([...parseCsv('')]).toEqual([]);
    expect([...parseCsvWithHeader('')]).toEqual([]);
  });

  it('maps rows to lower-cased headers and strips a BOM', () => {
    expect([...parseCsvWithHeader('﻿Drug_A, Level \nfoo, Major\nbar')]).toEqual([
      { drug_a: 'foo', level: 'Major' },
      { drug_a: 'bar', level: '' },
    ]);
  });
});

describe('mapMedmapRow', () => {
  const valid = {
    ingredient_a_rxcui: '1191',
    ingredient_b_rxcui: '11289',
    severity: 'serious',
    source_ref: 'SRC-1',
    mechanism: '',
    name_a: 'aspirin',
    name_b: '',
  };

  it('maps a valid row and turns empty optional cells into null', () => {
    expect(mapMedmapRow(valid)).toEqual({
      ingredientA: '1191',
      ingredientB: '11289',
      nameA: 'aspirin',
      nameB: null,
      severity: 'serious',
      mechanism: null,
      sourceRef: 'SRC-1',
    });
  });

  it('rejects unknown severities, bad ids and missing references with a reason', () => {
    expect(mapMedmapRow({ ...valid, severity: 'major' })).toMatch(/severity/);
    expect(mapMedmapRow({ ...valid, ingredient_a_rxcui: 'aspirin' })).toMatch(/ingredient_a_rxcui/);
    expect(mapMedmapRow({ ...valid, source_ref: '' })).toMatch(/source_ref/);
  });
});

describe('mapDdinterRow', () => {
  const resolve = (name: string) =>
    Promise.resolve(
      name === 'Aspirin'
        ? { rxcui: '1191', name: 'aspirin' }
        : name === 'Warfarin'
          ? { rxcui: '11289', name: 'warfarin' }
          : null,
    );
  const base = {
    ddinterid_a: 'DDInter1',
    drug_a: 'Aspirin',
    ddinterid_b: 'DDInter2',
    drug_b: 'Warfarin',
  };

  it('maps levels to severities and builds a source reference', async () => {
    expect(await mapDdinterRow({ ...base, level: 'Major' }, resolve)).toEqual({
      ingredientA: '1191',
      ingredientB: '11289',
      nameA: 'aspirin',
      nameB: 'warfarin',
      severity: 'serious',
      mechanism: null,
      sourceRef: 'ddinter:DDInter1-DDInter2',
    });
    expect(await mapDdinterRow({ ...base, level: 'minor' }, resolve)).toMatchObject({
      severity: 'minor',
    });
    expect(
      await mapDdinterRow({ drug_a: 'Aspirin', drug_b: 'Warfarin', level: 'Moderate' }, resolve),
    ).toMatchObject({ severity: 'moderate', sourceRef: 'ddinter' });
  });

  it('skips unknown levels and unmapped names instead of guessing', async () => {
    expect(await mapDdinterRow({ ...base, level: 'Unknown' }, resolve)).toMatch(/not imported/);
    expect(await mapDdinterRow({ ...base, drug_a: 'Mystery', level: 'Major' }, resolve)).toMatch(
      /Mystery/,
    );
    expect(await mapDdinterRow({ ...base, drug_b: 'Other', level: 'Major' }, resolve)).toMatch(
      /Other/,
    );
    expect(await mapDdinterRow({ level: 'Major' }, resolve)).toMatch(/missing/);
  });
});
