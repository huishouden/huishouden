export interface HouseholdApp {
  name: string;
  description: string;
  url: string;
  /** Inline SVG (Lucide, 24px grid, stroke follows text colour). */
  icon: string;
  /** False until the app is deployed; shown greyed out instead of linking to a dead URL. */
  live: boolean;
}

export const APPS: HouseholdApp[] = [
  {
    name: 'Spending',
    description: 'Card spending by month, category and card',
    url: 'https://huishouden-spending.web.app/',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    live: true,
  },
  {
    name: 'Tasks',
    description: 'Groceries, chores and shared lists',
    url: 'https://huishouden-tasks.web.app/',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',
    live: true,
  },
];
