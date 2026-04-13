# Stage 3: Forming Partnership

label stage3_partnership:
    scene bg garden with fade

    "Your chosen ally has become your primary partner in this investigation."

    if primary_ally == "hasper":
        show h at center with dissolve
        h "We make a good team. Let's see this through together."
    elif primary_ally == "liam":
        show l at center with dissolve
        l "Knowledge is power. Together, we have more of both."
    elif primary_ally == "yuki":
        show y at center with dissolve
        y "Two minds are better than one. Especially against something this weird."
    elif primary_ally == "kenji":
        show k at center with dissolve
        k "The path ahead is dark. But we walk it together."
    elif primary_ally == "maya":
        show m at center with dissolve
        m "Whatever comes next, we face it head-on."

    "Your bond strengthened, you feel ready for the next phase."

    jump stage3_revelation
