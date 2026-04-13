# Stage 7: Challenge the Echo

label stage7_challenge_echo:
    scene bg garden with fade

    mc "I understand your pain. But you're hurting innocent people."
    mc "We have a right to protect our reality."

    "Echo" "And I have a right to exist."

    "The Echo's form becomes more solid, more aggressive."

    show m at center with dissolve

    m "If this becomes a fight, we're ready."

    menu:
        "Stand firm - demand the Echo leave or submit":
            $ ending_type = "confrontation"
            "The Echo rises, energy crackling."
            jump stage7_battle

        "Back down - seek peaceful resolution":
            mc "Wait. This isn't the answer."
            jump stage7_help_echo
