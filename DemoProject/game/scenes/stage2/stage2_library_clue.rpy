# Stage 2: Library Path - Key Clue Discovery

label stage2_library_clue:
    scene bg library with fade

    show l at left with dissolve
    show k at right with dissolve

    l "If what Kenji says is true, then these historical records take on new meaning."

    k "They're not just history. They're warnings."

    l "Look at this passage: 'The Prism must remain undisturbed, for the Weaver's work depends upon it.'"
    l "And this note in the margin - it's in different handwriting."

    "Liam shows you a faded annotation."

    l "'Should the binding fail, seek the Weaver's thread in the place where light bends.'"

    $ clues_found.append("weavers_thread")
    $ evidence_score += 20

    mc "Where light bends? What does that mean?"

    k "I know exactly what it means. The garden. There's a specific spot where sunlight refracts unusually."
    k "I've been painting it for months. Something about that location is... different."

    $ relationship_l += 15
    $ relationship_k += 15

    l "We should investigate that location. But carefully."

    jump stage2_converge
