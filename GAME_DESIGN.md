# Game design

## Current vertical slice

The player receives the **Emergency Drive Plate** contract. They remove material from an aluminum blank while managing spindle state, feed override, heat, and tool condition. The cyan blueprint silhouette is the keep-zone. Removing excess stock progresses the job; cutting the keep-zone creates dimensional error.

Core loop: accept contract -> start spindle -> cut -> manage load -> inspect -> score -> earn credits -> retry.

Win condition: remove at least 88% of required stock and keep dimensional damage below the rejection threshold. Inspection grades geometry, finish, tool care, and time.

Failure is legible and recoverable: aggressive engagement raises heat and chatter; sustained overload breaks the tool, pauses cutting, costs credits, and explains why.

Progression is device-local for the prototype: credits, best score, completed contracts, and shop level.
