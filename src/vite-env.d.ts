/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Vizzhy Labs pilot front door (https). Unset = request route not yet connected. */
  readonly VITE_VIZZHY_LABS_PILOT_URL?: string;
}
