import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

let registered = false;

/**
 * Registers the ag-grid community modules.
 *
 * This lives here rather than in main.ts on purpose: importing ag-grid from the
 * bootstrap file pulled the whole grid into the initial bundle for every
 * visitor, even though only the admin screens use it. Calling this from the
 * lazy-loaded grid components keeps ag-grid inside their chunk.
 */
export function registerAgGridModules(): void {
  if (registered) {
    return;
  }
  ModuleRegistry.registerModules([AllCommunityModule]);
  registered = true;
}
