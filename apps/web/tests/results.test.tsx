import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_RESULT_WORDS, SAFETY_TEMPLATES } from '@medmap/shared';
import {
  FlaggedList,
  GraphLegend,
  ResultsSummary,
  ResultsTable,
} from '../src/presentation/features/results';
import { SeverityBadge, UncheckedBadge } from '../src/presentation/features/severity';
import { emptyCheck, sampleCheck } from './fixtures';
import { axeViolations } from './render';

function expectNoForbiddenWords(container: HTMLElement): void {
  const text = container.textContent.toLowerCase();
  for (const word of FORBIDDEN_RESULT_WORDS) {
    expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  }
}

describe('ResultsSummary', () => {
  it('shows counts for all three severities, the unchecked count and the dataset', () => {
    render(<ResultsSummary check={sampleCheck()} />);
    expect(screen.getByTestId('summary-line')).toHaveTextContent(
      '2 serious, 1 moderate, 1 minor across 5 medicines.',
    );
    expect(screen.getByTestId('unchecked-summary')).toHaveTextContent(
      '1 medicine could not be checked.',
    );
    expect(screen.getByTestId('dataset-attribution')).toHaveTextContent(
      'Source: MedMap demo set, version 1.0.0, updated 2026-01-02. Demo data, not medical information.',
    );
  });

  it('omits the unchecked notice when everything was checked', () => {
    render(<ResultsSummary check={emptyCheck()} />);
    expect(screen.queryByTestId('unchecked-summary')).toBeNull();
    expect(screen.getByTestId('summary-line')).toHaveTextContent('0 serious, 0 moderate, 0 minor');
  });
});

describe('FlaggedList', () => {
  it('lists pairs in the order given, each ending with the fixed pharmacist line and its source', () => {
    render(<FlaggedList check={sampleCheck()} />);
    const items = within(screen.getByTestId('flagged-list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Serious');
    expect(items[0]).toHaveTextContent('Alpha with Beta');
    for (const item of items) {
      expect(item).toHaveTextContent(SAFETY_TEMPLATES.askPharmacist);
      expect(item).toHaveTextContent('Source: MedMap demo set, version 1.0.0.');
    }
    expect(items[0]).toHaveTextContent('Made-up example for demos. Not a real interaction.');
    expect(items[3]).not.toHaveTextContent('From the source');
  });

  it('shows unchecked medicines with the reason, the coverage note and the urgent notice', () => {
    render(<FlaggedList check={sampleCheck()} />);
    const unchecked = screen.getByTestId('unchecked-list');
    expect(unchecked).toHaveTextContent('Mystery herb');
    expect(unchecked).toHaveTextContent(SAFETY_TEMPLATES.couldNotCheck);
    expect(screen.getByText(SAFETY_TEMPLATES.supplementCoverage)).toBeInTheDocument();
    expect(screen.getByText(SAFETY_TEMPLATES.urgent)).toBeInTheDocument();
  });

  it('with no flags, states only what the source lists and never reassures', () => {
    const { container } = render(<FlaggedList check={emptyCheck()} />);
    expect(screen.getByTestId('no-flags')).toHaveTextContent(
      'No known interaction found in this source (MedMap demo set, version 1.0.0, 2026-01-02). This does not mean the combination has no risks.',
    );
    expect(screen.queryByTestId('flagged-list')).toBeNull();
    expectNoForbiddenWords(container);
    expect(container.textContent).not.toMatch(/all clear|no problems|nothing to worry|✓|✔/i);
  });

  it('never renders a forbidden result word, with or without flags', () => {
    for (const check of [sampleCheck(), emptyCheck()]) {
      const { container, unmount } = render(
        <>
          <ResultsSummary check={check} />
          <FlaggedList check={check} />
          <ResultsTable check={check} />
          <GraphLegend />
        </>,
      );
      expectNoForbiddenWords(container);
      unmount();
    }
  });

  it('never tells the reader to stop or change a medicine', () => {
    const { container } = render(<FlaggedList check={sampleCheck()} />);
    expect(container.textContent).not.toMatch(
      /stop taking|do not take|skip|discontinue|change your dose/i,
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Results</h1>
        <ResultsSummary check={sampleCheck()} />
        <FlaggedList check={sampleCheck()} />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ResultsTable', () => {
  it('has a row for every flagged pair and every unchecked medicine', () => {
    render(<ResultsTable check={sampleCheck()} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(1 + 4 + 1);
    expect(rows[1]).toHaveTextContent('Alpha');
    expect(rows[1]).toHaveTextContent('demo:p1');
    expect(rows[5]).toHaveTextContent('Mystery herb');
    expect(rows[5]).toHaveTextContent('Could not check');
    expect(
      screen.getByText('Pairs that are not listed had no flag in this source.'),
    ).toBeInTheDocument();
  });

  it('shows the fixed sentence instead of an empty table', () => {
    render(<ResultsTable check={emptyCheck()} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/No known interaction found in this source/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ResultsTable check={sampleCheck()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('severity markers', () => {
  it('always carry a text label next to the icon', () => {
    render(
      <>
        <SeverityBadge severity="serious" />
        <SeverityBadge severity="moderate" />
        <SeverityBadge severity="minor" />
        <UncheckedBadge />
      </>,
    );
    for (const label of ['Serious', 'Moderate', 'Minor', 'Could not check']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('explains every line style in the legend, including that unflagged pairs have no line', () => {
    render(<GraphLegend />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(5);
    expect(legend).toHaveTextContent('Pairs with no flag in this source have no line.');
  });
});
