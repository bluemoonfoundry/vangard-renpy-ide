# Stage 8: Sterling Sacrifice Ending

label stage8_ending_sterling_sacrifice:
    scene bg library with fade

    "Professor Sterling retired immediately after the incident."

    show l at center with dissolve

    l "He doesn't remember much anymore. The ritual took more than expected."

    mc "Is he... okay?"

    l "He's peaceful. Lives in the faculty residence, tends a small garden."
    l "Sometimes he looks at the sky and smiles, like he's remembering something wonderful."

    "You visit Sterling's garden."

    show s at center with dissolve

    s "Hello... have we met?"

    mc "Yes, Professor. We worked together."

    s "Did we? That's nice."
    s "I don't remember much these days. But I feel... content."
    s "Like I did something important once."

    "His sacrifice saved everyone. But cost him his past."

    $ ending_type = "professor_sacrifice"

    jump stage8_epilogue_team
