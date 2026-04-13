# Stage 7: Help Echo Return Home

label stage7_help_echo:
    scene bg garden with fade

    mc "You don't belong here. Not because you're wrong, but because this isn't your home."

    "Echo" "Home... yes. I remember home. Fragments. Echoes of echoes."

    show s at left with dissolve
    show k at right with dissolve

    s "The ritual requires a conduit. Someone to anchor the pathway."
    k "And it requires sacrifice. A piece of memory given freely."

    menu:
        "I'll be the conduit":
            $ ending_type = "self_sacrifice"
            mc "Take what you need from me. Just... go home."
            jump stage7_ritual_self

        "Let Professor Sterling do it - it's his family's responsibility":
            $ ending_type = "sterling_sacrifice"
            s "Yes. This is my burden to bear."
            jump stage7_ritual_sterling

        "We all contribute - share the burden":
            if team_or_solo == "team":
                $ ending_type = "shared_sacrifice"
                h "Together. Like everything else."
                jump stage7_ritual_shared
            else:
                "You're alone. The choice is yours alone."
                jump stage7_ritual_self
