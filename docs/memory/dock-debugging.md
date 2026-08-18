# Dashboard dock debugging

## Current evidence

The web geometry test initially reported an iPhone 15 Pro viewport with these bounds:

- Shell: `0,0,393×659`
- Scroll viewport: `0,64,393×513`, ending at `y=577`
- Dock cylinder: `x=35.375,y=585,w=322.25,h=66`
- Recent context card: `x=20,y=599,w=353,h=170`, outside the visible scroll viewport

The dock now follows the Stack-like layered treatment: a dark full-width bottom backdrop, a narrower rounded dock surface with a subtle border, and a contained selected capsule. The implementation is solid rather than blurred so it remains deterministic across Expo Go and web. The `Recent context` card is compact so it can return without becoming a pale clipped block beside the dock.

## Expo Go capture

Run the development server with the project workflow and open the app in Expo Go. In Metro logs, look for lines beginning with `[Forge layout]`. Capture the full iPhone screen without cropping and record the device model.

The development probes report local and window bounds for the shell, scroll viewport, context card, dock slot, and dock cylinder, including each layer's intended background role. Compare the window bounds first; do not infer native geometry from the Playwright screenshot.

## Decision rule

Keep the dock in normal flow while the context card remains outside the visible scroll viewport. If Expo Go reports a different parent background or safe-area rectangle, fix that parent layer specifically. Do not switch to absolute positioning unless the native bounds prove that flow layout is the source of the visible artifact.
