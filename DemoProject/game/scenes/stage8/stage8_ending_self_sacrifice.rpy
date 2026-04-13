# Stage 8: Self Sacrifice Ending

label stage8_ending_self_sacrifice:
    scene bg garden with fade

    show h at center with dissolve

    h "How are you feeling? Still having memory gaps?"

    mc "A little. But nothing important, I think."

    "You can't quite remember your childhood pet's name."
    "Or your favorite food from before the academy."
    "Small things. Trivial things."
    "But they were yours."

    show l at left with dissolve

    l "I've documented everything that happened. The full history is preserved."

    mc "Good. Someone should remember."

    "You look at the garden. Peaceful. Safe."
    "The Echo is home. The academy is protected."
    "And you... you gave something of yourself to make it happen."

    $ ending_type = "heroic_sacrifice"

    jump stage8_epilogue_solo
