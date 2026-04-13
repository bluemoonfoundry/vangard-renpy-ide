# Stage 6: Final Occult Clue

label stage6_final_clue_occult:
    scene bg art_room with fade

    show k at center with dissolve

    k "The ritual is complete. I know what must be done."

    "Kenji's paintings now form a cohesive narrative."

    k "The Echo was never meant for our dimension. It fell through accidentally."
    k "Nathaniel didn't imprison a monster. He trapped a refugee."

    $ clues_found.append("echo_refugee")
    $ evidence_score += 30

    "Understanding changes perspective. Changes everything."

    jump stage6_evidence_compiled
