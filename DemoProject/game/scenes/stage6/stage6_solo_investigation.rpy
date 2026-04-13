# Stage 6: Solo Investigation

label stage6_solo_investigation:
    scene bg library with fade

    "You choose to walk this path alone."

    "It's dangerous. Perhaps foolish. But you won't risk others."

    $ evidence_score += 10

    "Working independently, you compile everything you've learned."

    menu:
        "Focus on the library records":
            jump stage6_final_clue_library

        "Analyze Yuki's technical data":
            jump stage6_final_clue_tech

        "Study Kenji's occult research":
            jump stage6_final_clue_occult
