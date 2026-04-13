# Stage 2: Investigation Paths - Begin
# Morning after discovery, paths diverge based on Stage 1 choice

label stage2_begin:
    scene bg academy_gate with fade

    "The next morning arrives with fog clinging to the academy grounds."

    if investigation_path == "library":
        "You head to the library to meet Liam and dive into historical research."
        jump stage2_library_path
    elif investigation_path == "tech":
        "You make your way to the computer lab where Yuki is analyzing security data."
        jump stage2_tech_path
    elif investigation_path == "social":
        "You meet Hasper at the administration office to begin interviewing witnesses."
        jump stage2_social_path
    elif investigation_path == "occult":
        "You find yourself drawn to the art room where Kenji explores the supernatural."
        jump stage2_occult_path
    else:
        "You need to decide on an investigation approach."
        jump stage1_choice
