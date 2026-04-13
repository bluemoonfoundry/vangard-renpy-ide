# Stage 3: Ally Reveals Secret

label stage3_revelation:
    scene bg library with fade

    if primary_ally == "hasper":
        show h at center with dissolve
        h "There's something I need to tell you about my family."
        h "My great-great-grandmother was a student here when the Prism was first installed."
        h "She wrote in her diary about 'the sealing ceremony.' About the Weaver."
        $ clues_found.append("hasper_ancestry")

    elif primary_ally == "liam":
        show l at center with dissolve
        l "I haven't been entirely honest about why I work here."
        l "My mentor, the previous librarian, disappeared ten years ago."
        l "He was researching the Prism. I've been continuing his work."
        $ clues_found.append("previous_librarian")

    elif primary_ally == "yuki":
        show y at center with dissolve
        y "I need to confess something. I've been hacking academy systems for months."
        y "Not maliciously! I was curious about data anomalies."
        y "I found evidence that someone has been accessing restricted files about the Prism for years."
        $ clues_found.append("long_term_access")

    elif primary_ally == "kenji":
        show k at center with dissolve
        k "I can see things. Not clearly, but... impressions of the past."
        k "Psychometry, some call it. I've been touching objects related to the Prism."
        k "I've seen fragments of what happened 179 years ago. The binding was... brutal."
        $ clues_found.append("kenji_psychometry")

    elif primary_ally == "maya":
        show m at center with dissolve
        m "This is going to sound weird, but lately I've been... stronger."
        m "Like, inhumanly so. I lifted equipment yesterday that should have been impossible."
        m "I think the entity's presence is affecting me. Maybe because I'm close to where it was bound."
        $ clues_found.append("maya_enhanced")

    $ evidence_score += 20

    "This revelation adds a new dimension to your understanding."

    jump stage3_night
