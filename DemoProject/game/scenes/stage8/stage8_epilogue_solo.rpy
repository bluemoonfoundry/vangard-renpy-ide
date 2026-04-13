# Stage 8: Solo Epilogue

label stage8_epilogue_solo:
    scene bg academy_gate with fade

    "You walk the academy grounds alone."

    "The path you chose was yours and yours alone."

    if ending_type == "heroic_sacrifice":
        "You gave something of yourself."
        "And in doing so, found purpose."
    elif ending_type == "pyrrhic_victory":
        "You chose safety over compassion."
        "The weight of that choice lingers."
    elif ending_type == "defeat":
        "You failed. But failure teaches."
        "Next time, you'll do better."

    "The semester ends. A new one begins."
    "And you carry the memory of the Echo with you."

    scene bg academy_gate with fade

    "Thank you for playing THE VANISHING ARTIFACT"

    "Your Ending: [ending_type]"
    "Friends Saved: [friends_saved]"
    "Evidence Score: [evidence_score]"
    "Mystery Solved: [mystery_solved]"

    return
