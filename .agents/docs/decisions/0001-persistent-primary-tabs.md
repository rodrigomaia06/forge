# ADR 0001: Persistent primary tabs

Status: Accepted
Date: 2026-09-02

## Context

Forge's primary destinations were sibling stack routes, each recreating its dock. That prevented a continuous selection indicator and made tab changes feel like stack navigation.

## Decision

Use React Navigation's Bottom Tabs navigator for Dashboard, History, Workout, Plans, and Settings. Keep the Forge dock as its custom tab bar, use the shared short cross-fade for tab content, and leave detail/editor routes in the parent native stack.

## Consequences

The dock persists across primary destinations, retains its Live Workout compact/expanded behaviour, and has one moving selection indicator. The Bottom Tabs package is a deliberate navigation dependency; domain data and persistence remain unchanged.

## Alternatives considered

Continue with sibling stack routes and recreate the dock per screen, or replace the Forge dock with the stock native tab bar. Both were rejected because they respectively break continuous dock motion or Forge's shared visual identity.
