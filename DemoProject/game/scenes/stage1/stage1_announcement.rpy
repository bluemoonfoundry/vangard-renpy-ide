# Stage 1: Discovery - Official Announcement
# Learn about the artifact from administration

label stage1_announcement:
    scene bg club_fair with fade

    "You enter the main building and immediately see a notice board surrounded by students."

    show h at left with dissolve

    h "Oh, you must be the new transfer student! I'm Hasper, student council president."
    h "I wish we could meet under better circumstances..."

    $ met_h = True
    $ relationship_h += 10

    mc "What's going on? Everyone seems worried."

    h "The Celestial Prism has vanished from the academy museum."
    h "It's a historical artifact that's been here for over a century."

    mc "Stolen?"

    h "We don't know yet. Professor Sterling discovered it missing this morning."
    h "The strange part is... there are no signs of forced entry."

    $ artifact_knowledge += 20
    $ clues_found.append("no_forced_entry")

    menu:
        "Ask Hasper about the artifact's significance":
            h "It's said to have been a gift from the academy's founder."
            h "Some say it has... unusual properties. But those are just legends."
            $ artifact_knowledge += 10
            jump stage1_meet_h

        "Ask who might want to steal it":
            h "That's what we're trying to figure out."
            h "Professor Sterling is coordinating with the authorities."
            jump stage1_meet_s
