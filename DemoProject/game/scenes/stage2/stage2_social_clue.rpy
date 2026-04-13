# Stage 2: Social Path - Key Clue Discovery

label stage2_social_clue:
    scene bg club_fair with fade

    show h at center with dissolve

    h "Let's compile what we've learned from the witnesses."

    mc "The timeline is becoming clearer."

    h "Professor Sterling left at 10 PM. The Prism was secure."
    h "The gliding figure was seen at 11:45 PM heading toward the museum."
    h "Whispers and silence at midnight."
    h "And the Prism was discovered missing at 7 AM."

    $ evidence_score += 10

    h "But here's what doesn't make sense - multiple witnesses mention the garden."
    h "The custodian said the whispers seemed to lead there."
    h "The student who saw the figure said they came from that direction."

    mc "Should we investigate the garden?"

    show h at left with dissolve
    show y at right with dissolve

    y "Already ahead of you. I pulled data on that location."

    $ met_y = True if not met_y else True

    y "There's a consistent thermal and electromagnetic anomaly in the northwest corner."
    y "It's been there for... well, as far back as the sensors go. Decades."

    $ clues_found.append("garden_anomaly")
    $ evidence_score += 20

    h "Then that's our next destination."

    $ relationship_h += 15
    $ relationship_y += 10

    jump stage2_converge
