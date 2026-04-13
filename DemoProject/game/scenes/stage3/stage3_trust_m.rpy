# Stage 3: Building Trust - Maya Route

label stage3_trust_m:
    scene bg gym with fade

    show m at center with dissolve

    m "Hey! I was hoping you'd show up. Need to blow off some steam?"

    "Maya tosses you a basketball."

    m "All this supernatural mystery stuff is intense. Sometimes you need to just... move."

    $ relationship_m += 20

    "You play basketball with Maya, finding rhythm in the physical activity."

    m "You know what I realized? I'm not scared anymore."
    m "I was at first. But now? I'm angry."

    mc "Angry at what?"

    m "At whatever took the Prism. At whatever is making my friends afraid."
    m "I protect people. That's what I do. And this thing is threatening everyone."

    $ clues_found.append("maya_protective")

    menu:
        "Your strength will be crucial in what's coming.":
            m "I hope so. Because I'm ready to fight."
            m "Not everything can be solved with books or computers."
            m "Sometimes you need someone who can take action."
            $ relationship_m += 15

        "Don't let anger cloud your judgment.":
            m "You're right. Anger is a tool, not a master."
            m "I'll be smart about this. But I won't back down."
            $ relationship_m += 10

    m "Whatever happens next, I've got your back."
    m "That's a promise."

    $ primary_ally = "maya"

    jump stage3_partnership
