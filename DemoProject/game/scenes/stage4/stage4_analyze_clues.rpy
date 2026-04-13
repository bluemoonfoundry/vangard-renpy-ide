# Stage 4: Analyzing All Clues

label stage4_analyze_clues:
    scene bg library with fade

    "The group reconvenes to process everything learned."

    show h at left with dissolve
    show l at center with dissolve
    show y at right with dissolve

    h "Let's review what we know."

    l "The Echo was imprisoned unjustly 179 years ago."
    y "Someone with knowledge of the binding released it."
    h "But its existence causes disturbances - not intentionally, but inevitably."

    mc "So what do we do?"

    menu:
        "Find a way to co-exist with the Echo":
            $ theory = "coexistence"
            h "Is that even possible?"
            jump stage4_theory_coexist

        "Re-bind the Echo, but more humanely":
            $ theory = "humane_binding"
            l "A compromise between imprisonment and freedom."
            jump stage4_theory_binding

        "Help the Echo leave our dimension entirely":
            $ theory = "dimensional_exit"
            y "Send it home, wherever that is."
            jump stage4_theory_exit

        "Destroy the Echo to save the academy":
            $ theory = "destruction"
            k "A dark path. But perhaps necessary."
            jump stage4_theory_destroy
