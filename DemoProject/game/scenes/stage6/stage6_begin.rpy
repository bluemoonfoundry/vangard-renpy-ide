# Stage 6: Alliance & Evidence - Begin
# Form final team and gather conclusive evidence

label stage6_begin:
    scene bg club_fair with fade

    "The crisis has passed for now, but the fundamental problem remains."

    show h at center with dissolve

    h "We need to make a final decision. Do we work together or do you handle this yourself?"

    menu:
        "Form a team - we're stronger together":
            $ team_or_solo = "team"
            jump stage6_team_formation

        "Go solo - this is my responsibility":
            $ team_or_solo = "solo"
            jump stage6_solo_investigation
