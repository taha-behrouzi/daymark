import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Settings,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { sectionHref, type AppSection } from '../../lib/router';

export interface NavItem {
  section: AppSection;
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}

export const sections: NavItem[] = [
  {
    section: 'today',
    label: 'Today',
    href: sectionHref('today'),
    icon: Sun,
    primary: true,
  },
  {
    section: 'tasks',
    label: 'Tasks',
    href: sectionHref('tasks'),
    icon: CheckCircle2,
    primary: true,
  },
  {
    section: 'planner',
    label: 'Planner',
    href: sectionHref('planner'),
    icon: CalendarClock,
    primary: true,
  },
  {
    section: 'calendar',
    label: 'Calendar',
    shortLabel: 'Calendar',
    href: sectionHref('calendar'),
    icon: CalendarDays,
    primary: true,
  },
  {
    section: 'goals',
    label: 'Goals',
    href: sectionHref('goals'),
    icon: Target,
  },
  {
    section: 'insights',
    label: 'Insights',
    href: sectionHref('insights'),
    icon: BarChart3,
  },
  {
    section: 'settings',
    label: 'Settings',
    href: sectionHref('settings'),
    icon: Settings,
  },
];
