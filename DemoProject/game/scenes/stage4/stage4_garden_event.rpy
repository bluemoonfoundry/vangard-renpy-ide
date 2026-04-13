# Stage 4: Strange Phenomena in Garden

label stage4_garden_event:
    scene bg garden with fade

    "The group moves to the garden where the anomalies are strongest."

    "The air shimmers with visible energy now. No longer subtle."

    show y at left with dissolve
    show k at right with dissolve

    y "My sensors are going crazy. Energy readings off the charts."
    k "The Echo is manifesting. It wants to communicate."

    "A form begins to take shape in the shimmer."
    "Not quite solid. Not quite transparent. Something in between."

    "Echo" "Finally... you see me. You hear me."

    $ supernatural_witnessed = True
    $ evidence_score += 25

    show m at center with dissolve

    m "Everyone stay calm. Don't make sudden movements."

    "Echo" "I mean no harm. I only seek... understanding. Freedom. Truth."

    menu:
        "Ask the Echo who released it":
            jump stage4_echo_liberation

        "Ask what the Echo wants":
            jump stage4_echo_desire

        "Ask if it's responsible for the disturbances":
            jump stage4_echo_effects
