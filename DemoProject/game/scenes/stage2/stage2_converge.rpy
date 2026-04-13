# Stage 2: Investigation Paths - Convergence
# All investigation paths lead to the garden

label stage2_converge:
    scene bg garden with fade

    "All paths of investigation have led to this moment."
    "The garden's northwest corner, where multiple anomalies converge."

    "As you approach, you feel it - a subtle wrongness in the air."

    if investigation_path == "library":
        show l at left with dissolve
        show k at right with dissolve
        l "According to the texts, this should be 'where light bends.'"
        k "And where the Weaver's thread can be found."

    elif investigation_path == "tech":
        show y at left with dissolve
        show l at right with dissolve
        y "My readings are going crazy here. Multiple energy signatures."
        l "This is the location mentioned in the historical records."

    elif investigation_path == "social":
        show h at left with dissolve
        show y at right with dissolve
        h "This is where the witnesses' accounts converge."
        y "And where my thermal data shows continuous anomalies."

    elif investigation_path == "occult":
        show k at center with dissolve
        k "Can you feel it? The entity's presence is stronger here."

    "You notice something on the ground - a pattern of stones arranged in a specific configuration."
    "At the center, a faint shimmer in the air, similar to what you saw in the security footage."

    menu:
        "Examine the stone pattern closely":
            $ clues_found.append("stone_pattern")
            $ evidence_score += 10
            "The stones form a symbol you don't recognize."
            "But as you study it, you feel a strange pull, like it's trying to communicate."

        "Reach out to touch the shimmer":
            $ supernatural_witnessed = True
            "The moment your hand approaches the shimmer, you feel a rush of images."
            "Fragments of memories not your own."
            "A figure trapped. A bargain made. A seal breaking."
            $ clues_found.append("memory_vision")
            $ evidence_score += 15

        "Step back and observe from a distance":
            $ evidence_score += 5
            "Caution is wise. The shimmer pulses gently, almost like breathing."

    "Suddenly, the shimmer expands and a voice echoes - not in your ears, but in your mind."

    "???" "Finally... seekers come."
    "???" "The binding weakens. The threads unravel. Time grows short."
    "???" "Find me. Free me. Before {i}it{/i} finds what it seeks."

    "The voice fades, and the shimmer contracts to its original size."

    $ current_stage = 3
    $ artifact_knowledge += 30

    "Stage 2 complete. The path forward becomes clearer - and more dangerous."

    jump stage3_begin
