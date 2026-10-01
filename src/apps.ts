export interface HouseholdApp {
  name: string;
  description: string;
  url: string;
  icon: string;
  /** False until the app is deployed; shown greyed out instead of linking to a dead URL. */
  live: boolean;
}

export const APPS: HouseholdApp[] = [
  {
    name: 'Spending',
    description: 'Card spending by month, category and card',
    url: 'https://huishouden-spending.web.app/',
    icon: '💳',
    live: true,
  },
  {
    name: 'Tasks & Groceries',
    description: 'Shared lists for the store and the house',
    url: 'https://huishouden-tasks.web.app/',
    icon: '🛒',
    live: true,
  },
];
