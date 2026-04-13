# Stage 2: Investigation - Technology Path
# Digital forensics with Yuki

label stage2_tech_path:
    scene bg computer_lab with fade

    show y at center with dissolve

    y "Perfect timing! I've got something weird to show you."

    $ met_y = True if not met_y else True
    $ relationship_y += 10
    $ tech_analysis_done = True

    y "So, I pulled the security footage from the museum wing like everyone expected."
    y "But here's the thing - there's a 47-minute gap in the recording."

    mc "A gap? Like the system was disabled?"

    y "That's what I thought at first. But no - the timestamps are continuous."
    y "It's like those 47 minutes just... didn't get recorded. No digital trace of tampering."

    $ clues_found.append("missing_footage")
    $ evidence_score += 15

    y "But I found something else. Someone accessed the museum's environmental controls remotely."
    y "They lowered the temperature by exactly 7.3 degrees Celsius."

    $ clues_found.append("temperature_anomaly")

    menu:
        "Why would someone lower the temperature?":
            y "That's what I'm trying to figure out. The Prism was kept in a climate-controlled case."
            y "Maybe temperature is relevant to its... properties?"
            $ artifact_knowledge += 10

        "Can you trace the remote access?":
            y "Already working on it. The connection was routed through multiple proxies."
            y "But I did find something interesting in the data patterns."
            y "The access signature matches historical logs from... three months ago. And six months before that."
            $ clues_found.append("previous_access")
            $ evidence_score += 10

    y "Oh, and one more thing. This might sound crazy, but..."
    y "The security system's AI flagged something in the footage before the gap."
    y "It detected a 'spatial anomaly' near the Prism's case. Whatever that means."

    $ supernatural_witnessed = True

    jump stage2_tech_clue
