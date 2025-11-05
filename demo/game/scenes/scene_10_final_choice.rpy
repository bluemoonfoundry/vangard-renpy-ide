label scene_10_final_choice:

    h "The day's almost over. It's time to choose. Which club will you join?"
    
    menu: # Choices 5 & 6 (Presented as one menu, but are distinct decisions)
        "I want to join the Book Club." if met_leo:
            $ joined_club = "Book Club"
            jump scene_11_ending
            
        "I'm signing up for the Sports Club!" if met_mia:
            $ joined_club = "Sports Club"
            jump scene_11_ending
            
        "I belong in the Art Club." if met_kaito:
            $ joined_club = "Art Club"
            jump scene_11_ending
        
        "The Gaming Club is my team." if met_yuki:
            $ joined_club = "Gaming Club"
            jump scene_11_ending