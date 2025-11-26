label scene_06_second_choice:
    scene bg garden
    
    s "So, have you seen all the clubs yet?"
    mc "Not even close. I've only seen one, really."
    
    s "Well, from here you can easily get to the Art Wing or the Tech Building."
    s "Which one piques your interest?"
    
    menu: # Choice 4
        "The Art Wing sounds inspiring.":
            jump scene_07_art_club
            
        "I want to see what's in the Tech Building.":
            jump scene_08_gaming_club