

# -- Image Placeholders --
# Define your background and character images here.
# For now, these are solid colors. Replace 'Solid(...)' with 'Image("images/filename.png")'
image bg academy_gate = Image("images/bg/academy_gate.png") #Solid("#cfcfff")
image bg club_fair = Image("images/bg/club_fair.png") #Solid("#ffd8b1")
image bg library = Image("images/bg/library.png") #Solid("#f5deb3")
image bg gym = Image("images/bg/gym.png") #Solid("#add8e6")
image bg garden = Image("images/bg/garden.png") #Solid("#90ee90")
image bg art_room = Image("images/bg/art_room.png") #Solid("#d3d3d3")
image bg computer_lab = Image("images/bg/computer_lab.png") #Solid("#333333")

# You would define character sprites like this:
# image leo_neutral = "images/leo_neutral.png"
# For simplicity, we will just show the character names.



init:
    transform size_normal:
        zoom 1.0
        ypos 1.3
        fit "contain"



# -- The game starts here --
label start:
    # Set the main character's name
    $ mc_name = persistent.mc_name

    # Jump to the very first scene file.
    jump scene_01_start
