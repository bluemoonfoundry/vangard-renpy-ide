# Stage 4: Who Released the Echo?

label stage4_echo_liberation:
    scene bg garden with fade

    "Echo" "The one who freed me... acted with purpose."
    "Echo" "They knew the cost. They accepted it."
    "Echo" "A descendant of the Weaver. Correcting an ancient wrong."

    $ clues_found.append("descendant_freed_echo")
    $ evidence_score += 20

    mc "A descendant? Who?"

    "The Echo's form flickers."

    "Echo" "The one who walks between... The one who remembers..."

    show s at center with dissolve

    s "It's speaking of bloodlines. The Weaver's descendants have lived in this academy's shadow for generations."

    jump stage4_suspect_s
