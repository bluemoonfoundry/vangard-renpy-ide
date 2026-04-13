# Stage 2: Investigation - Library Research Path
# Deep dive into historical records with Liam

label stage2_library_path:
    scene bg library with fade

    show l at center with dissolve

    l "Good, you're here. I've found several relevant texts overnight."
    l "The Celestial Prism's history is... fascinating and troubling."

    $ library_searched = True
    $ relationship_l += 10

    l "According to this journal from 1847, the academy's founder, Nathaniel Aether, created the Prism."
    l "But he didn't create it alone. He had help from someone referred to only as 'The Weaver.'"

    $ clues_found.append("the_weaver")
    $ artifact_knowledge += 20

    mc "The Weaver? Sounds ominous."

    l "There's more. Listen to this passage: 'The Prism must never be removed from its resting place.'"
    l "'To do so would unravel the binding, freeing that which was imprisoned within.'"

    $ evidence_score += 15

    menu:
        "Ask what was imprisoned":
            l "That's the question I've been trying to answer all night."
            l "The texts are deliberately vague. 'A presence.' 'An echo of the old world.' 'A mistake that gained consciousness.'"
            $ clues_found.append("entity_imprisoned")
            $ artifact_knowledge += 15

        "Ask about The Weaver's identity":
            l "I found a reference in another book. 'The Weaver who walks between threads of time.'"
            l "It sounds like mystical nonsense, but... given recent events..."
            $ clues_found.append("weaver_time")

    show l at left with dissolve
    show k at right with dissolve

    k "Mystical nonsense? Or uncomfortable truth?"

    l "Kenji. How long have you been listening?"

    $ met_k = True if not met_k else True

    k "Long enough. You're on the right track, but books only tell part of the story."
    k "The entity bound in the Prism isn't just history. It's been influencing the academy for decades."

    jump stage2_library_clue
