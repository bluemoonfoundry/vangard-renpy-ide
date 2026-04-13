# Stage 6: All Evidence Compiled

label stage6_evidence_compiled:
    scene bg library with fade

    "Every piece of the puzzle falls into place."

    if team_or_solo == "team":
        show h at left
        show l at center
        show y at right
        with dissolve

        h "So the Echo isn't a threat. It's a victim."
        l "Imprisoned for 179 years for the crime of existing."
        y "And it's been trying to tell us how to free it properly this whole time."

    else:
        "You compile the evidence alone, but the conclusion is clear."

    "The solution isn't imprisonment. Isn't destruction."
    "It's helping the Echo return to where it belongs."

    $ mystery_solved = True
    $ current_stage = 7

    jump stage6_preparation
