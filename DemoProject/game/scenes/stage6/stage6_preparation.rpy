# Stage 6: Preparation for Confrontation

label stage6_preparation:
    scene bg garden with fade

    "You return to the garden. To the place where dimensions touch."

    show s at center with dissolve

    s "You've figured it out. I can see it in your eyes."

    mc "You knew all along, didn't you? What needed to be done."

    s "I knew. But understanding and doing are different things."
    s "The ritual to open a dimensional pathway... it requires sacrifice."

    menu:
        "What kind of sacrifice?":
            s "Not life. But connection. Memory. A piece of oneself given freely."
            $ evidence_score += 10

        "We'll find another way":
            s "Perhaps. But time is short, and options few."

    "Stage 6 complete. The path is clear. The confrontation awaits."

    jump stage7_begin
