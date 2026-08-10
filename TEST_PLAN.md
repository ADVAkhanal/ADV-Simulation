# Test plan

Automated checks cover server rendering, game controls and copy, simulation constants, distinct contract geometry, enforced tool compatibility, operation routing/progress, deterministic inspection/disposition logic, save migration/mastery, and the independent G//CODE mode.

Playtest acceptance for the first slice:

- A new player starts cutting within 60 seconds without developer explanation.
- The player can identify the target silhouette and feed control.
- Overcut and tool overload produce understandable feedback.
- The player understands why one tool is valid or invalid for the active operation.
- The player can complete and sign off an ordered multi-operation plan.
- Inspection requires all three readings, communicates tolerance state, and blocks unsupported dispositions.
- Rework returns the player to a relevant operation; acceptance advances the contract ladder.
- Restart produces a fresh deterministic contract.
- Keyboard and pointer/touch paths work.

Subjective evidence still requires founder or external playtesting. The retention features are implemented and regression-tested, but no positive-reception or engagement claim is made yet.
