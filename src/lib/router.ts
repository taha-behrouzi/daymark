const SECTIONS = [
  'today',
  'tasks',
  'planner',
  'goals',
  'calendar',
  'insights',
  'settings',
] as const;

export type AppSection = (typeof SECTIONS)[number];

export interface Route {
  section: AppSection;
  query: Record<string, string>;
}

function isSection(value: string): value is AppSection {
  return (SECTIONS as readonly string[]).includes(value);
}

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = cleaned.split('?');
  const sectionRaw = pathPart.split('/')[0] ?? '';
  const section: AppSection = isSection(sectionRaw) ? sectionRaw : 'today';
  const query: Record<string, string> = {};
  const params = new URLSearchParams(queryPart);
  params.forEach((value, key) => {
    query[key] = value;
  });
  return { section, query };
}

export function buildHash(
  section: AppSection,
  query: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const search = params.toString();
  return `#/${section}${search ? `?${search}` : ''}`;
}

export function sectionHref(section: AppSection): string {
  return buildHash(section);
}

export const SECTION_LABELS: Record<AppSection, string> = {
  today: 'Today',
  tasks: 'Tasks',
  planner: 'Planner',
  goals: 'Goals',
  calendar: 'Calendar',
  insights: 'Insights',
  settings: 'Settings',
};
