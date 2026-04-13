# Stage 3: Building Trust - Liam Route

label stage3_trust_l:
    scene bg library with fade

    show l at center with dissolve

    l "I'm glad you're here. I found something... disturbing."

    "Liam leads you to a secluded corner of the restricted section."

    l "These archives go back to the academy's founding. And there's a pattern."
    l "Every 27 years, something happens. An accident. A disappearance. An unexplained phenomenon."

    $ relationship_l += 20
    $ clues_found.append("27_year_cycle")

    mc "That's oddly specific."

    l "Exactly. And we're in the 27th year of the current cycle."
    l "The last incident was a student who vanished without a trace."

    menu:
        "Do you think the entity is responsible?":
            l "I think the entity is connected to the cycle. Maybe even bound by it."
            l "The Prism might have been suppressing these events."
            $ relationship_l += 15

        "What happened to the missing student?":
            l "Never found. But there were reports of them being obsessed with the Prism."
            l "Reading about it constantly. Sketching it. Talking to themselves about 'the binding.'"
            $ relationship_l += 10

    l "I've dedicated my life to understanding history. But this..."
    l "This is history that's actively dangerous."

    $ primary_ally = "liam"

    jump stage3_partnership
