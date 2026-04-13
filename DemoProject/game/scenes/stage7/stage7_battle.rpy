# Stage 7: Battle with Echo

label stage7_battle:
    scene bg garden with fade

    "The confrontation turns violent. Reality warps."

    show m at center with dissolve

    m "Everyone, defensive positions!"

    "The battle is fierce. The Echo is powerful, but your teamwork prevails."

    if team_or_solo == "team" and evidence_score >= 100:
        "Working together, you find a way to force the Echo into submission."
        "Not destroyed. But weakened. Contained."
        $ mystery_solved = True
    else:
        "The Echo escapes, wounded but still free."
        "The academy is damaged. The mystery unsolved."
        $ mystery_solved = False

    $ ending_type = "battle"
    $ friends_saved -= 1

    jump stage7_aftermath
