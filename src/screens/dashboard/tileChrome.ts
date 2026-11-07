import { createContext, useContext } from 'react';

/** Edit-mode chrome state shared from the tile frame down to a tile's header,
 * so the header can reserve room for the gear button only when it's shown. */
export interface TileChrome {
  editing: boolean;
  hasSettings: boolean;
}

export const TileChromeContext = createContext<TileChrome>({ editing: false, hasSettings: false });

export function useTileChrome(): TileChrome {
  return useContext(TileChromeContext);
}

/** Right padding a tile header needs to clear the edit-mode Hide (and gear) buttons. */
export function tileHeaderRightInset(chrome: TileChrome): number {
  if (!chrome.editing) return 0;
  return chrome.hasSettings ? 68 : 34;
}
