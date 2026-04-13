# Stage 6: Final Library Clue

label stage6_final_clue_library:
    scene bg library with fade

    show l at center with dissolve

    l "I found it. The Weaver's original notes."

    "Liam shows you ancient pages, carefully preserved."

    l "'The Echo cannot be destroyed, only transformed. It is consciousness itself.'"
    l "'To unmake it would be to unmake the possibility of thought.'"

    $ clues_found.append("echo_cannot_destroy")
    $ evidence_score += 30

    "This changes everything. Destruction was never an option."

    jump stage6_evidence_compiled
