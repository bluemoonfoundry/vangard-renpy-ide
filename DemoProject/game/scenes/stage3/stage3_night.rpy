# Stage 3: Night Investigation - Convergence Point

label stage3_night:
    scene bg academy_gate with fade

    "Night falls over Aetheria Academy. The investigation must continue."

    show s at center with dissolve

    s "Ah. The young investigators. Your persistence is... notable."

    mc "Professor Sterling. What are you doing out here?"

    s "The same as you. Seeking answers."
    s "But unlike you, I know exactly where to look."

    menu:
        "Where should we look?":
            s "The museum itself. The site of the binding."
            s "Midnight approaches. The veil between what is and what was grows thin."
            $ relationship_s += 10

        "Why haven't you shared what you know?":
            s "Because knowledge without context is dangerous."
            s "You're building that context now. Soon you'll be ready."
            $ relationship_s += 5

    s "Meet me at the museum at midnight. All of you."
    s "What happens next will determine the fate of this academy."

    hide s with dissolve

    $ current_stage = 4

    "Stage 3 complete. Trust has been built. Secrets revealed. The path forward clarifies."

    jump stage4_begin
