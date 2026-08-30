export type ApplicationKindId = 'diagnostic' | 'inquiry';

export interface ApplicationKind {
  kind: ApplicationKindId;
  formSlug: string;
  title: string;
  lead: string;
  requiresLink: boolean;
  pipeline: 'application' | 'inquiry';
  welcome: string | null;
  staffLabel: string;
  enabled: boolean;
}

export const APPLICATION_KINDS: readonly ApplicationKind[];
export function applicationKind(kind: unknown): ApplicationKind | null;
export function enabledApplicationKinds(): ApplicationKind[];
