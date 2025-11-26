label scene_03_book_club:
    scene bg library
    $ met_leo = True
    
    show l at center, size_normal
    
    l "..."
    mc "Uh, hello? Is this the Book Club?"
    
    l "Hm? Oh. Yes. Welcome. I'm Leo."
    l "We're dedicated to the preservation and appreciation of the written word. From classic literature to modern sci-fi."
    
    mc "Sounds peaceful."
    
    menu: # Choice 2
        "I love classic fantasy novels.":
            l "A fine choice. The building blocks of entire genres."
        "I'm more into thrilling mystery stories.":
            l "An excellent way to sharpen the mind. I approve."
            
    l "If you value quiet contemplation, you might fit in here."
    
    jump scene_05_meet_sakura