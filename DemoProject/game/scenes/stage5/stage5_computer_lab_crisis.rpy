# Stage 5: Computer Lab Crisis - Digital Chaos

label stage5_computer_lab_crisis:
    scene bg computer_lab with fade

    "The computer lab is a nightmare of flickering screens and corrupted data."

    show y at center with dissolve

    y "The Echo is in the network! It's trying to communicate but it's overwhelming the systems!"

    "Screens display fragments of images, memories, code that shouldn't exist."

    $ friends_saved += 1
    $ relationship_y += 20

    menu:
        "Help Yuki establish communication protocol":
            y "Yes! If we can give it a structured way to communicate..."
            "Together you create a basic interface for the Echo."
            "The chaos subsides as the Echo learns to moderate its input."
            $ clues_found.append("echo_communication")
            $ evidence_score += 20

        "Shut down all systems to protect them":
            y "That might work, but we'd lose valuable data."
            "You initiate emergency shutdown protocols."
            "The systems power down, and the Echo retreats."
            $ evidence_score += 10

    "Crisis averted, but questions remain."

    jump stage5_emergency_meeting
