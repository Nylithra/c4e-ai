import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges conditional class names and resolves Tailwind conflicts
 * (the last utility of a group wins, e.g. `cn('p-2', 'p-4')` -> `p-4`).
 *
 * This is the standard shadcn/ui helper every primitive in `components/ui` uses.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
