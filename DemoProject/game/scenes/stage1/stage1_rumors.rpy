# Stage 1: Discovery - Student Rumors
# Gather information from gossiping students

label stage1_rumors:
    scene bg club_fair with fade

    "You approach a group of animated students."

    "Student 1" "Did you hear? The Celestial Prism is gone!"
    "Student 2" "I heard strange noises last night from the museum wing."
    "Student 3" "My friend swears she saw a shadowy figure near the art room at midnight."

    mc "Excuse me, what happened?"

    "Student 1" "Oh, you're new? The academy's most valuable artifact disappeared overnight!"

    $ artifact_knowledge += 15
    $ clues_found.append("strange_noises")
    $ clues_found.append("shadow_figure")

    show m at right with dissolve

    m "Hey! Don't scare the new kid with wild theories."
    m "I'm Maya, captain of the athletics club. Welcome to Aetheria."

    $ met_m = True
    $ relationship_m += 10

    m "The artifact going missing is serious, but let's not jump to supernatural conclusions."
    m "Though I have to admit... I did see something odd in the gym this morning."

    menu:
        "What did you see in the gym?":
            m "Equipment was moved around. Not by much, but I know where I left things."
            m "And there was this weird... shimmer in the air. Probably nothing."
            $ clues_found.append("gym_disturbance")
            $ supernatural_witnessed = True
            jump stage1_meet_h

        "Do you think someone from the academy took it?":
            m "I hope not. But I've been keeping my eyes open."
            m "You should talk to Hasper from student council. She's organizing search efforts."
            jump stage1_announcement
