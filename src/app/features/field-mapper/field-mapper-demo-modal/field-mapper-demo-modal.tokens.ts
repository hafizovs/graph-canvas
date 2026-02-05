import { InjectionToken } from '@angular/core';

/** Optional close callback from host. When provided, modal calls it on close (no import of modal type in host). */
export const FIELD_MAPPER_DEMO_CLOSE = new InjectionToken<() => void>('FIELD_MAPPER_DEMO_CLOSE');
