# Stage 8: Resolution - Begin
# Multiple endings based on choices made

label stage8_begin:
    scene bg academy_gate with fade

    "One week has passed since the confrontation."

    "The academy has returned to normal... or as normal as it can be after what happened."

    # Determine ending based on choices
    if ending_type == "self_sacrifice":
        jump stage8_ending_self_sacrifice
    elif ending_type == "sterling_sacrifice":
        jump stage8_ending_sterling_sacrifice
    elif ending_type == "shared_sacrifice":
        jump stage8_ending_shared_perfect
    elif ending_type == "integration":
        jump stage8_ending_integration
    elif ending_type == "battle" and mystery_solved:
        jump stage8_ending_battle_victory
    elif ending_type == "battle" and not mystery_solved:
        jump stage8_ending_battle_defeat
    else:
        # Default ending
        jump stage8_ending_bittersweet
