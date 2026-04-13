# Stage 1: Discovery - Evening Convergence
# All paths converge as day ends and investigation begins

label stage1_evening:
    scene bg garden with fade

    "As the sun sets, you find yourself in the academy garden, reflecting on the day's discoveries."

    "What started as a simple theft is clearly something more complex."

    if "prism_is_seal" in clues_found:
        "Professor Sterling's words echo in your mind: 'It was a seal.'"
        "What was being sealed? And what happens now that it's broken?"

    if "mystical_origin" in clues_found:
        "The artifact's mystical origins suggest this is no ordinary case."

    if "shadow_figure" in clues_found:
        "Someone or something was seen near the museum at midnight."

    show h at center with dissolve

    h "There you are. I wanted to check in before curfew."
    h "How are you holding up? It's a lot for your first day."

    mc "I'm managing. This mystery is... intriguing."

    h "Tomorrow we dive deeper. Get some rest tonight."
    h "Oh, and [mc_name]? Be careful. Whatever took the Prism might still be watching."

    hide h with dissolve

    "As Hasper leaves, you notice something odd in the garden."
    "The statue at the center seems to shimmer, as if viewed through heat waves."
    "But the evening air is cool."

    $ supernatural_witnessed = True
    $ current_stage = 2

    "Tomorrow, the real investigation begins."

    # Stage 1 complete - proceed to Stage 2
    jump stage2_begin
