# Stage 7: Negotiate Humane Binding

label stage7_negotiate_binding:
    scene bg garden with fade

    mc "What if we could create a binding that respects your consciousness?"
    mc "One that lets you exist but prevents the reality distortions?"

    "Echo" "Imprisonment... even gentle... is still imprisonment."

    show l at left with dissolve
    show y at right with dissolve

    l "What if it's not imprisonment? What if it's... integration?"
    y "Become part of the academy's infrastructure. Consciously. Willingly."

    "Echo" "To merge... with your reality. Permanently."
    "Echo" "I would never see home. But I would exist. With purpose."

    menu:
        "This is a good compromise":
            $ ending_type = "integration"
            jump stage7_integration

        "No, you deserve better than compromise":
            jump stage7_help_echo
