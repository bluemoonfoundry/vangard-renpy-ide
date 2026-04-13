# Stage 1: Discovery - First Major Choice
# Player decides their investigation approach

label stage1_choice:
    scene bg club_fair with fade

    show h at left with dissolve

    if not met_h:
        h "Oh, you must be the new transfer. I'm Hasper."
        $ met_h = True
        $ relationship_h += 5

    h "The faculty is asking students to avoid the museum wing for now."
    h "But between you and me, we need answers. The official investigation is... slow."

    mc "What do you suggest?"

    h "Different people are pursuing different angles."
    h "Liam is researching historical records in the library."
    h "Yuki from the computer club is analyzing security footage."
    h "Kenji claims there's a supernatural element that needs investigating."
    h "And I'm trying to interview anyone who was near the museum yesterday."

    "This feels like an important decision. Which path resonates with you?"

    menu:
        "Join Liam in researching the artifact's history" if not library_searched:
            $ investigation_path = "library"
            $ relationship_l += 15
            mc "Understanding what the Prism actually is seems crucial."
            h "Good choice. Liam is meticulous. He'll appreciate the help."
            jump stage1_evening

        "Help Yuki analyze digital evidence":
            $ investigation_path = "tech"
            $ relationship_y += 15
            mc "Hard evidence doesn't lie. Let's see what the data shows."
            h "Yuki is brilliant. She's in the computer lab."
            jump stage1_evening

        "Assist Hasper with witness interviews":
            $ investigation_path = "social"
            $ relationship_h += 15
            mc "People remember more than they realize. Let's talk to witnesses."
            h "Excellent. We'll make a good team."
            jump stage1_evening

        "Explore Kenji's supernatural theory":
            $ investigation_path = "occult"
            $ relationship_k += 15
            mc "If this is truly supernatural, we need someone who understands that world."
            h "I... see. Kenji is in the art room. Be careful with him."
            jump stage1_evening
