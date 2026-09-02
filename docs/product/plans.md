# Plans and routines

- Plans contain ordered routines; a routine may also exist without a plan.
- A routine holds a name, workout type, optional note and attributes, and a reusable exercise/set structure.
- Users can create, edit, duplicate, move, delete, and start routines. Starting a routine creates an independent active workout, so later edits do not alter an in-progress session.
- The Plans screen groups standalone routines and plans separately. Routine rows use their workout-type icon, and swiping left on a routine or plan reveals its destructive Delete action.
- Routine and plan overflow actions use the shared Forge action sheet with labelled icons instead of a platform-native alert. Routine actions are Start, Edit, Duplicate, and Delete; plan actions are Add routine and Delete plan.
- Plans and routines are local-only and persist through the Forge repository boundary during the prototype-storage phase.
- The Plans header action presents New workout, New routine, and New workout plan from an anchored menu. The Dashboard creation action routes into Plans and opens this same menu. New workout starts immediately; the other actions create their local draft destination.
- New standalone routines are created from that header action only; the Plans list does not expose a bottom creation button.
