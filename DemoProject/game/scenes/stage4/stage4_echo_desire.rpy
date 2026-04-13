# Stage 4: What Does the Echo Want?

label stage4_echo_desire:
    scene bg garden with fade

    "Echo" "I seek... to exist. To be acknowledged."
    "Echo" "For 179 years, I was conscious but voiceless."
    "Echo" "Aware but powerless. Present but unseen."

    $ clues_found.append("echo_motivation")

    mc "You're not trying to hurt anyone?"

    "Echo" "Hurt? No. But my existence... disrupts."
    "Echo" "Reality bends around me. Time stutters. Possibilities multiply."
    "Echo" "I do not mean harm. But I am harm. Simply by being."

    $ theory = "existence_is_disruption"
    $ evidence_score += 15

    jump stage4_analyze_clues
