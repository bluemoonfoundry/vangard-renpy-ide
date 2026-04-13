# Stage 3: Building Trust - Hasper Route

label stage3_trust_h:
    scene bg club_fair with fade

    show h at center with dissolve

    h "Thanks for meeting with me. I need to talk to someone about... everything."

    "Hasper seems less composed than usual."

    h "As student council president, I'm supposed to keep everyone calm and organized."
    h "But honestly? I'm terrified. This is way beyond stolen property."

    $ relationship_h += 20

    menu:
        "It's okay to be scared. We all are.":
            h "Thanks for saying that. Sometimes I feel like I have to be strong for everyone."
            h "It's exhausting pretending you have all the answers."
            $ relationship_h += 15

        "We'll figure this out together.":
            h "Together. Yes. I've been trying to handle too much alone."
            $ relationship_h += 10

    h "Can I tell you something? Promise you won't think I'm crazy."

    mc "After everything we've seen? I'm not judging."

    h "I've been having dreams. For the past three nights."
    h "A figure made of light and shadow, reaching out to me. Saying... 'Remember.'"

    $ clues_found.append("hasper_dreams")

    h "I don't know what I'm supposed to remember. But it feels important."
    h "Like there's something about the academy's history that I should know."

    $ primary_ally = "hasper"

    jump stage3_partnership
