# Stage 5: Emergency Meeting - Assess Situation

label stage5_emergency_meeting:
    scene bg library with fade

    "Everyone reconvenes in the library, shaken but determined."

    show h at left with dissolve
    show l at center with dissolve
    show s at right with dissolve

    h "The disturbances are getting worse. We're running out of time."

    s "The Echo is destabilizing. Without the Prism to contain it, it's unraveling our reality."

    l "We need to make a decision. Now."

    menu:
        "We protect our friends and evacuate":
            $ theory = "protection"
            jump stage5_protect_path

        "We pursue a solution with the Echo":
            $ theory = "solution"
            jump stage5_pursue_path
