# Stage 3: Building Trust - Yuki Route

label stage3_trust_y:
    scene bg computer_lab with fade

    show y at center with dissolve

    y "Okay, you need to see this. And please don't freak out."

    "Yuki shows you lines of code on her screen."

    y "I've been analyzing the academy's network traffic. Looking for any unusual patterns."
    y "And I found messages. Encrypted messages being sent from {i}inside{/i} the academy."

    $ relationship_y += 20

    mc "Someone here is communicating about the Prism?"

    y "Not exactly. The messages aren't from anyone. They're from the {i}network itself{/i}."
    y "It's like the entity is using our digital infrastructure to... think? Communicate?"

    $ clues_found.append("entity_in_network")

    menu:
        "Can you decrypt the messages?":
            y "I've been trying. They're using an encryption method that shouldn't exist yet."
            y "Mathematical principles that are theoretically possible but not practically implemented."
            y "Whatever this entity is, it's intelligent. Terrifyingly so."
            $ relationship_y += 15

        "Can you shut it out of the network?":
            y "I tried. It adapted instantly. Like it was learning from my attempts."
            y "The best I can do is monitor and try to understand what it wants."
            $ relationship_y += 10

    y "I'm a tech person, [mc_name]. I believe in logic and data."
    y "But this? This is rewriting the rules as we watch."

    $ primary_ally = "yuki"

    jump stage3_partnership
