# Stage 1: Discovery - Meeting Professor Sterling
# The cryptic professor who discovered the theft

label stage1_meet_s:
    scene bg library with fade

    "You find Professor Sterling in the restricted section of the library, surrounded by ancient texts."

    show s at center with dissolve

    s "..."

    mc "Professor Sterling? I'm the new transfer student. I wanted to ask about the missing artifact."

    s "Did you now."

    "He doesn't look up from his book."

    $ met_s = True

    s "Everyone wants to ask about the Prism. Few understand what it truly represents."
    s "Tell me, young one. Do you believe in forces beyond our immediate perception?"

    menu:
        "I believe there's more to the world than we understand":
            s "Wise answer. The Prism was never just an artifact."
            s "It was a seal. A containment vessel. And now it's been broken."
            $ artifact_knowledge += 30
            $ clues_found.append("prism_is_seal")
            $ relationship_s += 15

        "I prefer to deal with facts and evidence":
            s "A pragmatist. Understandable, if limiting."
            s "But even pragmatists must acknowledge when facts defy conventional explanation."
            $ relationship_s += 5

    s "Be cautious in your curiosity, [mc_name]. Some mysteries demand a price for their answers."

    if relationship_s >= 15:
        s "Since you seem genuinely interested... Meet me in the garden this evening."
        s "There are things that cannot be discussed openly."
        jump stage1_evening
    else:
        jump stage1_choice
