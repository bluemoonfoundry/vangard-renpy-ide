# Stage 4: Professor Sterling - Suspect or Ally?

label stage4_suspect_s:
    scene bg garden with fade

    show s at center with dissolve

    h "Professor Sterling... are you the Weaver's descendant?"

    "Sterling is silent for a long moment."

    s "Yes."

    $ culprit_identified = "sterling"
    $ evidence_score += 30

    s "My great-great-great-grandfather was the Weaver."
    s "I inherited his knowledge. His guilt. His responsibility."

    mc "Did you release the Echo?"

    menu:
        "Believe Sterling's confession":
            s "I did. Because the binding was wrong. A crime against a conscious being."
            s "But I underestimated the consequences."
            $ relationship_s += 15

        "Doubt Sterling's story":
            s "You're wise to question. But I speak truth."
            s "Though I may not be telling all of it."
            $ relationship_s -= 5

    jump stage4_analyze_clues
