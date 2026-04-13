# Stage 5: Gym Crisis - Maya in Danger

label stage5_gym_crisis:
    scene bg gym with fade

    "The gym's space is warping. Distances don't make sense."

    show m at center with dissolve

    m "Thank god you're here! The room keeps... changing."
    m "I walked toward the door three times. Each time I ended up back at center court."

    "A spatial loop. The Echo's influence is growing stronger."

    $ friends_saved += 1
    $ relationship_m += 20

    menu:
        "Use Yuki's technical knowledge to disrupt the loop" if investigation_path == "tech":
            "You remember Yuki's explanation of energy patterns."
            "By moving in a specific counter-pattern, you break the loop."
            $ evidence_score += 15

        "Follow Kenji's occult advice about dimensional rifts" if investigation_path == "occult":
            "Kenji taught you about 'thin places.'"
            "You guide Maya to a point where reality is more stable."
            $ evidence_score += 15

        "Trust Maya's athletic instincts":
            m "You're right. I've been overthinking this."
            m "Sometimes the answer is simple - go through the wall."
            "Maya charges the gym wall, which ripples like water, and you both pass through."
            $ evidence_score += 10

    "You and Maya escape the gym as it collapses back to normal."

    jump stage5_emergency_meeting
