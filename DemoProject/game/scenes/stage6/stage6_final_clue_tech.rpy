# Stage 6: Final Tech Clue

label stage6_final_clue_tech:
    scene bg computer_lab with fade

    show y at center with dissolve

    y "I've cracked it. The Echo's communication attempts weren't random."

    "Yuki displays decoded data."

    y "It's been trying to tell us how to help it. Look - coordinates."
    y "Not spatial coordinates. Dimensional ones."

    $ clues_found.append("dimensional_coordinates")
    $ evidence_score += 30

    "The Echo wants to go home. It always has."

    jump stage6_evidence_compiled
