label scene_08_gaming_club:
    scene bg computer_lab
    $ met_yuki = True
    
    #show y at center, size_normal
    scene computer_lab
    show h:
        xalign 0.69 yalign 0.62 zoom 1.5 zorder 1
    show l:
        xalign 0.59 yalign 0.78 zoom 2 xzoom -1.0 zorder 2
    show m:
        xalign 0.49 yalign 0.79 zoom 2 zorder 3
    
    y "Target locked! Activating ult! ...BOOM! GG."
    y "Whoa, a new player has entered the zone! Welcome to the Gaming Club's HQ."
    
    mc "You seem busy."
    
    y "Busy winning! I'm Yuki. We do everything from competitive esports to casual board games and even some programming."
    y "We're a team that strategizes, communicates, and dominates. Wanna hop on for a match?"
    
    jump scene_09_reflection