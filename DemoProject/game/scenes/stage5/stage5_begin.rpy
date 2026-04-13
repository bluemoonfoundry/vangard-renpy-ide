# Stage 5: Crisis Escalation - Begin
# Supernatural events intensify across campus

label stage5_begin:
    scene bg academy_gate with fade

    "The academy is in chaos. Reality itself seems unstable."

    show h at center with dissolve

    h "We're getting reports from multiple locations. The gym, computer lab, art room..."
    h "People are trapped or in danger."

    mc "We need to split up and help them!"

    $ crisis_handled = True

    menu:
        "Rush to the gym to help Maya":
            jump stage5_gym_crisis

        "Head to computer lab to assist Yuki":
            jump stage5_computer_lab_crisis

        "Go to art room to find Kenji":
            jump stage5_art_room_crisis
