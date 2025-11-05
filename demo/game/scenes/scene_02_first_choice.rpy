label scene_02_first_choice:
    scene bg club_fair
    
    h "Alright, we're here! It's a bit overwhelming, I know."
    h "To make it easier, how about we start with one of two areas?"
    h "There's the 'Hall of Minds' where the intellectual clubs are, or the 'Field of Spirit' for the more active ones."
    
    menu: # Choice 1
        "Let's check out the Hall of Minds.":
            jump scene_03_book_club
            
        "The Field of Spirit sounds exciting!":
            jump scene_04_sports_club