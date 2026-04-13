# Stage 8: Team Epilogue

label stage8_epilogue_team:
    scene bg club_fair with fade

    "The semester ends with a celebration."

    show h at left
    show l at center
    show m at right
    with dissolve

    h "We did it. Together."
    l "The full story is documented. Future generations will learn from this."
    m "And if something like this happens again, we'll be ready."

    show y at left
    show k at right
    with dissolve

    y "I've upgraded all security systems. Nothing gets past us now."
    k "And I've painted the whole saga. Art preserves truth."

    if ending_type == "perfect_ending":
        "Everyone survived. The Echo found peace."
        "And you forged bonds that will last a lifetime."
    elif ending_type == "integration_ending":
        "The Echo remains, woven into the academy."
        "Not a threat. Not a prisoner. A presence."
    elif ending_type == "professor_sacrifice":
        "Professor Sterling's sacrifice saved everyone."
        "You honor his memory by living well."
    elif ending_type == "bittersweet":
        "The victory wasn't perfect. But you survived."
        "And that's worth celebrating."

    "The group photo is taken. Smiles all around."
    "Whatever comes next, you face it together."

    scene bg academy_gate with fade

    "Thank you for playing THE VANISHING ARTIFACT"

    "Your Ending: [ending_type]"
    "Friends Saved: [friends_saved]"
    "Evidence Score: [evidence_score]"
    "Mystery Solved: [mystery_solved]"

    return
