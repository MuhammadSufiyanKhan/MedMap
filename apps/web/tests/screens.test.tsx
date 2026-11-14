import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAFETY_TEMPLATES } from '@medmap/shared';
import { usePreferences } from '../src/application/stores/preferences';
import { MedicineForm } from '../src/presentation/features/MedicineForm';
import {
  DemoBanner,
  FirstRunNotice,
  FooterDisclaimer,
  OfflineBanner,
} from '../src/presentation/features/notices';
import { DATASET, id } from './fixtures';
import { axeViolations, renderWithProviders } from './render';

const PROFILE = id(600);
let createdBodies: unknown[] = [];
let lookupDown = false;

const server = setupServer(
  http.get('*/api/v1/app-config', () =>
    HttpResponse.json({
      dataset: DATASET,
      demoMode: true,
      labelExtraction: { enabled: false, provider: null, maxImages: 3, maxImageBytes: 5_242_880 },
    }),
  ),
  http.get('*/api/v1/drugs/normalize', ({ request }) => {
    const term = new URL(request.url).searchParams.get('term') ?? '';
    if (lookupDown) {
      return HttpResponse.json(
        {
          type: 'https://medmap.example/problems/name-lookup-unavailable',
          title: 'Service unavailable',
          status: 503,
          detail: 'Lookup down.',
          requestId: 'r',
        },
        { status: 503 },
      );
    }
    return HttpResponse.json({
      term,
      source: 'MedMap demo names',
      candidates: term.toLowerCase().startsWith('demo')
        ? [
            {
              rxcui: 'DEMO-0001',
              name: 'Demolol',
              termType: 'IN',
              ingredients: [{ rxcui: 'DEMO-0001', name: 'Demolol' }],
              score: null,
            },
          ]
        : [],
    });
  }),
  http.post(`*/api/v1/profiles/${PROFILE}/medications`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    createdBodies.push(body);
    return HttpResponse.json(
      {
        id: id(700 + createdBodies.length),
        profileId: PROFILE,
        displayName: body.displayName,
        rxcui: body.rxcui ?? null,
        ingredientRxcuis: body.rxcui ? ['DEMO-0001'] : [],
        ingredientNames: body.rxcui ? ['Demolol'] : [],
        strengthText: body.strengthText ?? null,
        kind: body.kind,
        source: body.source,
        status: 'active',
        version: 1,
        createdAt: '2026-11-14T09:30:00.000Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
      { status: 201 },
    );
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  createdBodies = [];
  lookupDown = false;
  usePreferences.setState({
    noticeAccepted: false,
    extractionConsent: false,
    theme: 'system',
    textSize: 'normal',
  });
});

describe('DemoBanner', () => {
  it('shows the fixed demo wording when the active dataset is demo, with no way to close it', async () => {
    renderWithProviders(<DemoBanner />);
    const banner = await screen.findByRole('note', { name: 'Demo data' });
    expect(banner).toHaveTextContent(SAFETY_TEMPLATES.demoBanner);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing for a real dataset', async () => {
    server.use(
      http.get('*/api/v1/app-config', () =>
        HttpResponse.json({
          dataset: { ...DATASET, kind: 'real', licenceStatus: 'confirmed' },
          demoMode: false,
          labelExtraction: {
            enabled: false,
            provider: null,
            maxImages: 3,
            maxImageBytes: 5_242_880,
          },
        }),
      ),
    );
    const { container } = renderWithProviders(<DemoBanner />);
    await waitFor(() => {
      expect(server.listHandlers().length).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('first-run notice and footer', () => {
  it('blocks until accepted, then stays away', async () => {
    renderWithProviders(<FirstRunNotice />);
    const dialog = screen.getByRole('dialog', { name: 'Before you start' });
    expect(dialog).toHaveTextContent(SAFETY_TEMPLATES.notAdvice);
    expect(dialog).toHaveTextContent(SAFETY_TEMPLATES.urgent);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(usePreferences.getState().noticeAccepted).toBe(true);
  });

  it('puts the not-medical-advice notice in the footer', () => {
    renderWithProviders(<FooterDisclaimer />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(SAFETY_TEMPLATES.notAdvice);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(SAFETY_TEMPLATES.urgent);
  });

  it('shows the offline banner only while offline', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { unmount } = renderWithProviders(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('You are offline');
    unmount();
    spy.mockReturnValue(true);
    renderWithProviders(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    spy.mockRestore();
  });
});

describe('MedicineForm', () => {
  it('saves nothing until the review step is confirmed, then sends the chosen match', async () => {
    const onSaved = vi.fn();
    renderWithProviders(<MedicineForm profileId={PROFILE} source="manual" onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText('Name on the label'), 'Demolol');
    await userEvent.click(await screen.findByRole('radio', { name: 'Demolol' }));
    await userEvent.type(screen.getByLabelText(/Strength/), '10 mg');
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(screen.getByRole('heading', { name: 'Check before saving' })).toBeInTheDocument();
    expect(screen.getByTestId('review-name')).toHaveTextContent('Demolol');
    expect(createdBodies).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Save medicine' }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('Demolol');
    });
    expect(createdBodies).toEqual([
      {
        displayName: 'Demolol',
        strengthText: '10 mg',
        kind: 'unknown',
        source: 'manual',
        rxcui: 'DEMO-0001',
      },
    ]);
  });

  it('requires a choice when matches exist, and lets the user go back and edit', async () => {
    renderWithProviders(<MedicineForm profileId={PROFILE} source="manual" onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Name on the label'), 'Demolol');
    await screen.findByRole('radio', { name: 'Demolol' });
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText(/Pick the matching medicine/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /None of these/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByText(/MedMap cannot check it/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change something' }));
    expect(screen.getByLabelText('Name on the label')).toHaveValue('Demolol');
  });

  it('saves an unmatched name as could-not-check', async () => {
    const onSaved = vi.fn();
    renderWithProviders(<MedicineForm profileId={PROFILE} source="label" onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText('Name on the label'), 'Granny herbs');
    expect(await screen.findByText(/No match found/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save medicine' }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(createdBodies[0]).toMatchObject({ rxcui: null, source: 'label' });
  });

  it('still lets the user save when the name lookup is down', async () => {
    lookupDown = true;
    renderWithProviders(<MedicineForm profileId={PROFILE} source="manual" onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Name on the label'), 'Demolol');
    expect(await screen.findByText(/name lookup is not available/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('heading', { name: 'Check before saving' })).toBeInTheDocument();
  });

  it('validates the name and shows a server error without losing the form', async () => {
    server.use(
      http.post(`*/api/v1/profiles/${PROFILE}/medications`, () =>
        HttpResponse.json(
          {
            type: 'https://medmap.example/problems/medication-limit-reached',
            title: 'Conflict',
            status: 409,
            detail: 'A profile can hold up to 40 active medicines.',
            requestId: 'r',
          },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<MedicineForm profileId={PROFILE} source="manual" onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Enter the medicine name')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name on the label'), 'Zzz');
    await screen.findByText(/No match found/);
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save medicine' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 40 active medicines');
  });

  it('has no axe violations in either step', async () => {
    const { container } = renderWithProviders(
      <MedicineForm profileId={PROFILE} source="manual" onSaved={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText('Name on the label'), 'Demolol');
    await userEvent.click(await screen.findByRole('radio', { name: 'Demolol' }));
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
