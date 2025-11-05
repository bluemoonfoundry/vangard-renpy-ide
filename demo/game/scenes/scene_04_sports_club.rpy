label scene_04_sports_club:
    scene bg gym
    $ met_mia = True
    
    show m at center, size_normal
    
    m "Hey! New recruit! You look like you've got some fire in you!"
    mc "I was just looking around..."
    
    m "Looking is the first step to doing! I'm Mia, captain of everything that involves a ball."
    m "We're all about pushing our limits, teamwork, and victory! Want to run a few laps?"

    menu: # Choice 3
        "Maybe just one lap!":
            m "That's the spirit! C'mon, I'll race ya!"
        "I think I'll just watch for now.":
            m "Alright, suit yourself! But you're missing out!"
            
    m "If you've got energy to burn, you know where to find us!"
    
    jump scene_05_meet_sakura