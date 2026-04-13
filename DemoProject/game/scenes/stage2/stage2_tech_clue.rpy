# Stage 2: Tech Path - Key Clue Discovery

label stage2_tech_clue:
    scene bg computer_lab with fade

    show y at center with dissolve

    y "Okay, I managed to reconstruct part of the missing footage using backup data from the fire alarm system."
    y "It has an independent camera. Lower resolution, but it caught something."

    "Yuki brings up grainy footage on the screen."

    y "Watch carefully. Right... there."

    "You see a distortion in the air near the Prism's case, like heat shimmer."
    "Then the Prism seems to... phase out of existence."

    mc "It didn't break. It didn't get carried away. It just vanished?"

    y "That's what the data shows. And look at this thermal reading."
    y "The moment it vanished, there was a temperature spike in one specific location."

    "She pulls up a thermal map of the academy."

    y "The garden. Northwest corner. Temperature increased by 15 degrees for exactly 3 seconds."

    $ clues_found.append("garden_thermal_spike")
    $ evidence_score += 20

    show y at left with dissolve
    show l at right with dissolve

    l "The garden? That's... interesting."

    $ met_l = True if not met_l else True

    l "I found references to 'the place where light bends' in historical texts about the Prism."
    l "Could it be the same location?"

    $ relationship_y += 15
    $ relationship_l += 10

    jump stage2_converge
