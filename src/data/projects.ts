export type Project = {
  name: string;
  /** Optional link. Leave it out for unpublished work. */
  href?: string;
  /** e.g. "2026 · Python" — shown in small muted type under the name. */
  meta?: string;
  description: string;
};

/** Newest first, or whatever order you prefer — this list renders as written. */
export const projects: Project[] = [
  {
    name: 'Example project',
    href: 'https://example.com',
    meta: '2026 · TypeScript',
    description:
      'A short description of what it is and why you made it. Edit or delete this entry in src/data/projects.ts.',
  },
];
