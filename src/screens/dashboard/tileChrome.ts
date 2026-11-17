import { createContext, useContext } from 'react';
import type { ViewStyle } from 'react-native';
import { forgeCardRadius } from '../../components/ui/ForgeCard';

/** Tile card padding; edit mode widens the leading inset to hold the drag rail. */
export const TILE_PADDING = 16;
export const TILE_DRAG_RAIL_WIDTH = 40;

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

/**
 * Press tint for content that opens its whole tile: it reaches past the tile
 * padding to the card's edges and rounded corners (the card clips it), so the
 * pressed state covers the visible card instead of an inset square.
 */
export function tileBodyPressFeedback(chrome: TileChrome): ViewStyle {
  return {
    top: -TILE_PADDING,
    right: -TILE_PADDING,
    bottom: -TILE_PADDING,
    left: -(chrome.editing ? TILE_DRAG_RAIL_WIDTH : TILE_PADDING),
    borderRadius: forgeCardRadius,
  };
}
