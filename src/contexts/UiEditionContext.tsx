import { createContext, useContext } from 'react';
import type { UiEdition } from '../types/ui';

export const UiEditionContext = createContext<UiEdition>('classic');

export function useUiEdition(): UiEdition {
  return useContext(UiEditionContext);
}
