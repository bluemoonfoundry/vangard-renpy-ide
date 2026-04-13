# Stage 1: Discovery - Meeting Hasper
# Student council president provides official perspective

label stage1_meet_h:
    scene bg club_fair with fade

    if not met_h:
        show h at center with dissolve

        h "You must be the new transfer student. I'm Hasper, student council president."
        h "Welcome to Aetheria Academy, though I wish it were under better circumstances."

        $ met_h = True
        $ relationship_h += 10
    else:
        show h at center with dissolve
        h "I'm glad you're taking an interest in this situation."

    h "The Celestial Prism's disappearance has everyone on edge."
    h "I'm coordinating with faculty to ensure student safety while investigating."

    mc "Do you think students are in danger?"

    h "Honestly? I don't know. But some of the reports I'm hearing are... unusual."
    h "Equipment moving on its own. Strange lights. Temperature fluctuations."

    $ relationship_h += 5

    menu:
        "Offer to help investigate":
            h "Really? That's... actually very helpful."
            h "We need level-headed people. Most students are either terrified or treating it like a game."
            $ relationship_h += 10
            h "Let me introduce you to Professor Sterling. He knows more about the artifact's history."
            jump stage1_meet_s

        "Ask what Hasper thinks happened":
            h "Between you and me? This doesn't feel like a simple theft."
            h "The security logs show nothing. No alarms triggered. It's as if the Prism just... vanished."
            $ clues_found.append("no_security_breach")
            jump stage1_choice
