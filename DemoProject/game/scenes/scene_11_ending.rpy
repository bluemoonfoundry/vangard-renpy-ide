label scene_11_ending:
    scene bg club_fair
    
    if joined_club == "Book Club":
        show l at center, size_normal with dissolve
        l "An excellent decision. I look forward to our discussions."
        
    elif joined_club == "Sports Club":
        show m at center, size_normal with dissolve
        m "Yes! Welcome to the team! Practice is tomorrow at dawn!"

    elif joined_club == "Art Club":
        show k at center, size_normal with dissolve
        k "Good. Let's create something the world has never seen."
        
    elif joined_club == "Gaming Club":
        show y at center, size_normal with dissolve
        y "Awesome! I'll send you a discord invite. Welcome to the party!"
        
    mc "I think I'm going to like it here."
    
    jump scene_12_goodbye