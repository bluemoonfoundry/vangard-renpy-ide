# Stage 5: Pursuit Path

label stage5_pursue_path:
    scene bg garden with fade

    "You head directly to the garden, where the Echo's presence is strongest."

    show k at left with dissolve
    show y at right with dissolve

    k "Bold. Risky. But perhaps necessary."
    y "If we can reach it now, while it's manifesting strongly..."

    $ team_or_solo = "pursuit"

    "You attempt direct communication with the Echo."

    "Echo" "You come. Not in fear. Not in anger. In... hope?"

    "This could be the breakthrough you need."

    $ evidence_score += 25
    $ current_stage = 6

    jump stage6_begin
