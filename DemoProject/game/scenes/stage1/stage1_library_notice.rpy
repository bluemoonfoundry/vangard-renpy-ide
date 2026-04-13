# Stage 1: Discovery - Library Investigation Notice
# Meet Liam at the library

label stage1_library_notice:
    scene bg library with fade

    "The library is unusually crowded. At the center, you see someone posting notices."

    show l at center with dissolve

    l "...historical significance cannot be overstated. Anyone with information, please..."

    mc "Excuse me, what's this about?"

    l "Oh. You must be new. I'm Liam, the librarian's assistant."
    l "The Celestial Prism has been taken from the museum."

    $ met_l = True
    $ relationship_l += 10

    l "I've been researching its history. This isn't just a valuable object."
    l "According to records, it was crafted by the academy's founder using... unconventional methods."

    $ artifact_knowledge += 25

    mc "Unconventional how?"

    l "The founder was known to study alchemy and ancient mysticism."
    l "The Prism was meant to be more than decorative. But the exact purpose was never documented."

    $ clues_found.append("mystical_origin")

    menu:
        "Ask to see the historical records":
            l "Certainly. I've pulled several relevant texts."
            l "Though some of the oldest ones are... difficult to interpret."
            $ library_searched = True
            jump stage1_meet_s

        "Ask if he suspects anyone":
            l "I try not to speculate. But... Professor Sterling has been acting strangely."
            l "He was in the archives yesterday, searching for something specific."
            $ clues_found.append("sterling_suspicious")
            jump stage1_meet_h
