# Stage 1: Discovery - Arrival
# Player arrives at the academy on an unusual day

label stage1_arrival:
    scene bg academy_gate with fade

    $ current_stage = 1

    "The autumn morning greets you as you approach Aetheria Academy's main gate."
    "Something feels different today. The usual bustle of students seems... anxious."

    mc "First day as a transfer student, and the energy is already strange."

    "You notice clusters of students whispering, glancing toward the main building."

    menu:
        "Approach a group of students to ask what's happening":
            jump stage1_rumors

        "Head straight to the administration office":
            jump stage1_announcement

        "Walk toward the library where a crowd has gathered":
            jump stage1_library_notice
